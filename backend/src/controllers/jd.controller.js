const jdService = require('../services/jd.service');

const submit = async (req, res, next) => {
  try {
    const { jdText } = req.body;
    const jd = await jdService.submitJd(req.user.id, jdText);

    // 202 Accepted — the work is queued, not done yet
    // frontend should poll /status to know when prep kit is ready
    res.status(202).json({
      success: true,
      message: 'JD received. Your prep kit is being generated.',
      data: {
        jdId: jd.id,
        status: jd.status,
        jobTitle: jd.job_title,
        companyName: jd.company_name,
      },
    });
  } catch (err) {
    if (err.upgradeRequired) {
      return res.status(403).json({
        success: false,
        message: err.message,
        upgradeUrl: '/pricing',
      });
    }
    next(err);
  }
};

const getStatus = async (req, res, next) => {
  try {
    const result = await jdService.getPrepKit(req.params.jdId, req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getAnalysis = async (req, res, next) => {
  try {
    const jd = await jdService.getJdAnalysis(req.params.jdId, req.user.id);
    res.json({ success: true, data: jd });
  } catch (err) {
    next(err);
  }
};

const listMine = async (req, res, next) => {
  try {
    const jds = await jdService.listUserJds(req.user.id);
    res.json({ success: true, data: jds });
  } catch (err) {
    next(err);
  }
};

module.exports = { submit, getStatus, getAnalysis, listMine };
