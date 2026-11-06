const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  name: { type: String, required: [true, 'Project name is required'], trim: true },
  code: { type: String, trim: true, index: true },
  description: { type: String, trim: true },
  projectType: { type: String, enum: ['software_delivery', 'client_delivery', 'hr_process', 'operations', 'small_task'], default: 'software_delivery', index: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  startDate: { type: Date },
  endDate: { type: Date },
  status: { type: String, enum: ['planned', 'active', 'completed', 'on-hold', 'cancelled'], default: 'planned', index: true },
  workflowStatus: {
    type: String,
    enum: [
      'draft',
      'assigned_to_hr',
      'assigned_to_manager',
      'in_execution',
      'manager_review',
      'hr_review',
      'ceo_review',
      'changes_requested',
      'approved',
      'rejected'
    ],
    default: 'draft',
    index: true
  },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  assignedHr: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  assignedDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', index: true },
  currentReviewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  documents: [{
    originalName: { type: String, trim: true },
    filename: { type: String, trim: true },
    mimetype: { type: String, trim: true },
    size: { type: Number, min: 0 },
    url: { type: String, trim: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedByRole: { type: String, enum: ['admin', 'hr', 'manager', 'employee'] },
    stage: { type: String, enum: ['ceo_assignment', 'hr_assignment', 'manager_assignment', 'employee_submission', 'manager_review', 'hr_review', 'ceo_review'] },
    note: { type: String, trim: true, maxlength: 2000 },
    uploadedAt: { type: Date, default: Date.now }
  }],
  workflowHistory: [{
    action: { type: String, required: true },
    fromStatus: String,
    toStatus: String,
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    note: { type: String, trim: true, maxlength: 2000 },
    createdAt: { type: Date, default: Date.now }
  }],
  latestReview: {
    note: { type: String, trim: true, maxlength: 2000 },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    requestedAt: Date
  },
  metadata: { type: Object },
  document: {
    originalName: { type: String, trim: true },
    filename: { type: String, trim: true },
    mimetype: { type: String, trim: true },
    size: { type: Number, min: 0 },
    url: { type: String, trim: true },
    uploadedAt: { type: Date }
  },
  // ============ Hierarchical Navigation (Materialized Path pattern) ============
  parentProject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    default: null,
    index: true
  },
  level: {
    type: Number,
    default: 0,
    min: 0
  },
  hierarchy: {
    // Materialized path, e.g. "root:project_aaa:project_bbb:project_ccc".
    // Every node is a prefix of all of its descendants, enabling a single
    // $regex prefix query to fetch the node AND its full sub-tree.
    path: {
      type: String,
      default: '',
      index: true
    },
    depth: { type: Number, default: 0 }
  },
  ancestorIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project'
  }],
  // Owning department for the top-level project (links the Project tree into
  // the Department tree so a department drill-down can resolve its tasks).
  departmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    index: true
  },
  isDeleted: { type: Boolean, default: false, select: false },
  deletedAt: Date,
  deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

projectSchema.index({ name: 1 });
projectSchema.index({ parentProject: 1, level: 1 });
projectSchema.index({ 'hierarchy.path': 1 });
projectSchema.index({ workflowStatus: 1, assignedHr: 1 });
projectSchema.index({ workflowStatus: 1, assignedManager: 1 });

// Pre-save middleware: rebuild the materialized path whenever the node is
// created or re-parented. Descendant paths are re-derived recursively so the
// invariant "parent path is a prefix of child path" always holds.
projectSchema.pre('save', async function(next) {
  if (!this.isNew && !this.isModified('parentProject')) {
    return next();
  }

  try {
    const Project = this.constructor;

    if (this.parentProject) {
      const parent = await Project.findById(this.parentProject).select('hierarchy level');
      if (parent) {
        this.hierarchy.path = `${parent.hierarchy.path || `root:${parent._id.toString()}`}:${this._id.toString()}`;
        this.hierarchy.depth = parent.hierarchy.depth + 1;
        this.level = parent.level + 1;
      } else {
        this.parentProject = null;
        this.hierarchy.path = `root:${this._id.toString()}`;
        this.hierarchy.depth = 0;
        this.level = 0;
      }
    } else {
      this.hierarchy.path = `root:${this._id.toString()}`;
      this.hierarchy.depth = 0;
      this.level = 0;
    }

    // Recompute ancestor ids from the materialized path segments.
    this.ancestorIds = this.hierarchy.path
      .split(':')
      .filter((segment) => segment && segment !== 'root')
      .filter((segment) => segment !== this._id.toString())
      .map((segment) => {
        try {
          return new mongoose.Types.ObjectId(segment);
        } catch (err) {
          return null;
        }
      })
      .filter(Boolean);

    next();
  } catch (err) {
    next(err);
  }
});

// Static: fetch a node plus every descendant in one indexed prefix query.
projectSchema.statics.findNodeWithDescendants = function(projectId) {
  const escaped = String(projectId).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return this.find({
    $or: [
      { _id: projectId },
      { 'hierarchy.path': { $regex: `^.*:${escaped}(:|$)` } }
    ]
  });
};

// Static: fetch all nodes strictly below a parent node (for peer scans).
projectSchema.statics.findSiblings = function(projectId) {
  return this.find({ parentProject: projectId });
};

// Static: build a nested tree with a single aggregation call using $graphLookup.
projectSchema.statics.getProjectTree = async function() {
  const roots = await this.aggregate([
    { $match: { isDeleted: { $ne: true } } },
    { $sort: { level: 1, name: 1 } },
    {
      $graphLookup: {
        from: 'projects',
        startWith: '$_id',
        connectFromField: '_id',
        connectToField: 'parentProject',
        as: 'descendants',
        maxDepth: 50
      }
    },
    { $match: { $or: [{ parentProject: null }, { parentProject: { $exists: false } }] } }
  ]);

  const build = (node, nodesByParent) => {
    const hydrated = {
      _id: node._id,
      name: node.name,
      code: node.code,
      status: node.status,
      level: node.level,
      hierarchy: node.hierarchy,
      children: (nodesByParent.get(node._id.toString()) || [])
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((child) => build(child, nodesByParent))
    };
    return hydrated;
  };

  // Index all docs by parent id.
  const allDocs = roots.flatMap((root) => [root, ...root.descendants]);
  const nodesByParent = new Map();
  allDocs.forEach((doc) => {
    const key = doc.parentProject ? doc.parentProject.toString() : 'root';
    if (!nodesByParent.has(key)) nodesByParent.set(key, []);
    nodesByParent.get(key).push(doc);
  });

  const tree = roots.map((root) => build(root, nodesByParent));
  return tree;
};

// Instance: rebuild descendant materialized paths after a re-parent (recursive).
projectSchema.methods.rebuildDescendantPaths = async function() {
  const Project = this.constructor;
  const queue = [this];
  const rebuild = async (node) => {
    const children = await Project.find({ parentProject: node._id }).select('_id parentProject level');
    for (const child of children) {
      child.hierarchy.path = `${node.hierarchy.path}:${child._id.toString()}`;
      child.hierarchy.depth = node.hierarchy.depth + 1;
      child.level = node.level + 1;
      child.ancestorIds = child.hierarchy.path
        .split(':')
        .filter((segment) => segment && segment !== 'root' && segment !== child._id.toString())
        .map((segment) => {
          try {
            return new mongoose.Types.ObjectId(segment);
          } catch (err) {
            return null;
          }
        })
        .filter(Boolean);
      await child.save({ validateBeforeSave: false });
      await rebuild(child);
    }
  };
  await rebuild(this);
};

projectSchema.pre('deleteOne', { document: true, query: false }, async function(next) {
  try {
    await this.constructor.deleteMany({
      'hierarchy.path': { $regex: `^${this.hierarchy.path}:` }
    });
    next();
  } catch (err) {
    next(err);
  }
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
