// Lean queries and aggregation results do not apply schema defaults to legacy imports.
function list(value) {
  return (Array.isArray(value) ? value : value == null ? [] : [value]).filter(
    (item) => item != null,
  );
}
module.exports = function normalizeCompanyArrays(company) {
  return {
    ...company,
    assignedTo: list(company.assignedTo),
    points_of_contact: list(company.points_of_contact),
  };
};
