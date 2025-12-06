const path = require('path');

const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
require('dotenv').config();

//const projectRoutes = require('./routes/project');
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const pmsRoutes = require('./routes/pms');
const memberRoutes = require('./routes/member');
const userRoutes = require('./routes/user');
const app = express();

// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json
app.use('/images', express.static(path.join(__dirname, 'images')));
app.use('/uploads', express.static('uploads'));


app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});


app.use('/auth', authRoutes);
app.use('/company', companyRoutes);
app.use('/pm', pmsRoutes);
app.use('/member', memberRoutes);
app.use('/me', userRoutes);

app.use((error, req, res, next) => {
    console.log(error);
    const status = error.statusCode || 500;
    const message = error.message;
    res.status(status).json({ message: message });
});

connectDB()
    .then(() => {
        console.log('MongoDB connected');
        app.listen(process.env.PORT, () => {
            console.log(`Server running on port ${process.env.PORT}`);
        });
    })
    .catch(err => {
        console.error('Database connection failed:', err);
    });