const authService = require('../services/auth.service');
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
exports.register = async (req, res, next) => {
    try {
        const { name, grade, student_id, password, personal_email } = req.body;
        if (!name || !grade || !student_id || !password || !personal_email) {
            return res.status(400).json({ error: '所有欄位皆為必填' });
        }

       if (!emailRegex.test(personal_email)) {
            return res.status(400).json({ error: '信箱格式不正確，請檢查是否有漏打 @ 或 .' });
        }

        const newUser = await authService.registerUser({
            name, grade, student_id, password, personal_email
        });

        res.status(201).json({ message: '註冊成功', user: newUser });
    } catch (error) {
        next(error);
    }
};

exports.login = async (req, res, next) => {
    try {
        const { student_id, password } = req.body;

        if (!student_id || !password) {
            return res.status(400).json({ error: '請輸入學號與密碼' });
        }

        const result = await authService.loginUser(student_id, password);
        
        res.status(200).json({ message: '登入成功', ...result });
    } catch (error) {
        next(error);
    }
};

exports.logout = async (req, res, next) => {
    try {
        // 如果使用 JWT，前端清除 token 即可，後端可能不需要做什麼，或者將 token 加入黑名單
        res.status(200).json({ message: '登出成功' });
    } catch (error) {
        next(error);
    }
};

exports.getMe = async (req, res, next) => {
    try {
        // req.user 應該在 auth.middleware 中被設定
        if (!req.user) {
            return res.status(401).json({ error: '未經授權' });
        }
        res.status(200).json({ user: req.user });
    } catch (error) {
        next(error);
    }
};
