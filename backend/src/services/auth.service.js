const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '7d';

exports.registerUser = async (userData) => {
    const { name, grade, student_id, password, personal_email } = userData;

    const existingUser = await User.findByStudentId(student_id);
    if (existingUser) {
        throw new Error('此學號已經註冊過囉');
    }
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const newUser = await User.create({
        name,
        grade,
        student_id,
        password_hash: hashedPassword,
        personal_email,
        role: 'regular'
    });

    const { password_hash, ...userWithoutPassword } = newUser;
    return userWithoutPassword;
};

exports.loginUser = async (student_id, password) => {
    const user = await User.findByStudentId(student_id);
    if (!user) {
        throw new Error('學號或密碼錯誤');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
        throw new Error('學號或密碼錯誤');
    }

    const token = jwt.sign(
        { id: user.id, student_id: user.student_id, role: user.role },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );

    const { password_hash, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
};
