const { requestListener } = require("../server");

module.exports = async (req, res) => {
  return requestListener(req, res);
};
