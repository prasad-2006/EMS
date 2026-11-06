const AuditEvent = require('../models/AuditEvent');
const { Parser } = require('json2csv');

const buildFilter = (query) => {
  const filter = {};
  if (query.action) filter.action = query.action;
  if (query.resourceType) filter.resourceType = query.resourceType;
  if (query.actorRole) filter.actorRole = query.actorRole;
  if (query.startDate || query.endDate) {
    filter.createdAt = {};
    if (query.startDate) filter.createdAt.$gte = new Date(query.startDate);
    if (query.endDate) filter.createdAt.$lte = new Date(query.endDate);
  }
  return filter;
};

const listAuditEvents = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
    const filter = buildFilter(req.query);
    const [events, total] = await Promise.all([
      AuditEvent.find(filter).populate('actorId', 'name email role').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      AuditEvent.countDocuments(filter)
    ]);
    if (req.query.format === 'csv') {
      const parser = new Parser({ fields: ['createdAt', 'actorRole', 'action', 'resourceType', 'resourceId', 'note', 'correlationId'] });
      const csv = parser.parse(events.map((event) => event.toObject()));
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="audit-events.csv"');
      return res.send(csv);
    }
    return res.json({ success: true, data: events, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Failed to fetch audit events' });
  }
};

module.exports = { listAuditEvents };
