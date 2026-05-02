const authService = require('../services/auth.service');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

exports.register = async (req, res, next) => {
    try {
        const { name, grade, student_id, password, personal_email } = req.body;
        if (!name || !grade || !student_id || !password || !personal_email) {
            return res.status(400).json({ error: 'All fields are required' });
        }

       if (!emailRegex.test(personal_email)) {
            return res.status(400).json({ error: 'Invalid email format. Please check for missing @ or .' });
        }

        const newUser = await authService.registerUser({
            name, grade, student_id, password, personal_email
        });

        res.status(201).json({ message: 'Registration successful', user: newUser });
    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { student_id, password } = req.body;

        if (!student_id || !password) {
            return res.status(400).json({ error: 'Please provide student ID and password' });
        }

        const result = await authService.loginUser(student_id, password);
        
        res.status(200).json({ message: 'Login successful', ...result });
    } catch (error) {
        next(error);
    }
};

exports.logout = async (req, res, next) => {
    try {
        // If using JWT, the frontend just needs to clear the token. The backend might not need to do anything, or it could blacklist the token.
        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        next(error);
    }
};

exports.getMe = async (req, res, next) => {
    try {
        // req.user should be set in auth.middleware
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        res.status(200).json({ user: req.user });
    } catch (error) {
        next(error);
    }
};