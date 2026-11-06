const path = require('path');
const fs = require('fs');
const Task = require('../models/Task');
const Project = require('../models/Project');

const downloadTaskArtifact = async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId).select('assignedTo projectId attachments');
    if (!task) return res.status(404).json({ success: false, error: 'Task not found' });
    const project = task.projectId ? await Project.findById(task.projectId).select('assignedManager assignedHr') : null;
    const userId = req.user._id.toString();
    const allowed = req.user.role === 'admin' || task.assignedTo.toString() === userId || project?.assignedManager?.toString() === userId || project?.assignedHr?.toString() === userId;
    if (!allowed) return res.status(403).json({ success: false, error: 'You are not allowed to access this artifact' });
    const safeFilename = path.basename(req.params.filename);
    const attachment = (task.attachments || []).find((item) => item.storedFilename === safeFilename);
    if (!attachment) return res.status(404).json({ success: false, error: 'Artifact not found' });
    const filePath = path.join(__dirname, '../uploads/tasks', safeFilename);
    if (!fs.existsSync(filePath)) return res.status(404).json({ success: false, error: 'Artifact file is unavailable' });
    return res.download(filePath, attachment.filename);
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to access artifact' });
  }
};

module.exports = { downloadTaskArtifact };
