// middleware/authMiddleware.js
function ensureAuthenticated(req, res, next) {
  if (req.session.user) {
    res.locals.user = req.session.user; // Pass the user to the template
    return next();
}
res.redirect('/user-login');
}

module.exports = ensureAuthenticated;
