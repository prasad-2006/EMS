const departmentMembershipQuery = (departmentId) => ({
  $or: [
    { department: departmentId },
    { departments: departmentId }
  ]
});

const departmentMembershipInQuery = (departmentIds) => ({
  $or: [
    { department: { $in: departmentIds } },
    { departments: { $in: departmentIds } }
  ]
});

const normalizeDepartmentIds = (departmentIds = [], primaryDepartmentId = null) => {
  const values = [primaryDepartmentId, ...(Array.isArray(departmentIds) ? departmentIds : [])]
    .filter(Boolean)
    .map((departmentId) => departmentId.toString());

  return [...new Set(values)];
};

module.exports = {
  departmentMembershipQuery,
  departmentMembershipInQuery,
  normalizeDepartmentIds
};