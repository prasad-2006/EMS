const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getHierarchyTree } = require('../controllers/hierarchyController');

router.use(protect);
router.get('/', getHierarchyTree);

module.exports = router;
