const { getCombinedTree } = require('../services/hierarchyService');

// @desc    Get the deeply nested Department + Project hierarchy tree
// @route   GET /api/hierarchy
// @access  Private (scope pruned by role)
const getHierarchyTree = async (req, res) => {
  try {
    const tree = await getCombinedTree(req);
    res.status(200).json({
      success: true,
      data: tree
    });
  } catch (err) {
    console.error('[Hierarchy] Failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
};

module.exports = { getHierarchyTree };
