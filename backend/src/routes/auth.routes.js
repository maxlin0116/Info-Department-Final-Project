const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { authenticate } = require('../middlewares/auth.middleware');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/password-reset/request', authController.requestPasswordReset);
router.post('/password-reset/confirm', authController.resetPassword);

router.post('/logout', authenticate, authController.logout);
router.get('/me', authenticate, authController.getMe);
router.patch('/password', authenticate, authController.changePassword);

module.exports = router;
