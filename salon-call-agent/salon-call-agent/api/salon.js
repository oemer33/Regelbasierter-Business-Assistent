const { loadSalon } = require("../src/validate");

module.exports = (req, res) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(JSON.stringify(loadSalon()));
};
