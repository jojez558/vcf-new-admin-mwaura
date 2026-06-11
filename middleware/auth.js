module.exports = (req, res, next) => {
  if (req.session && req.session.adminId) {
    return next();
  }
  if (req.path === '/login' || req.path === '/login-page') return next();
  res.redirect('/admin/login-page');
};
