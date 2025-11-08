const path = require('path');
require('dotenv').config();


const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');

//const projectRoutes = require('./routes/project');
const authRoutes = require('./routes/auth');
const companyRoutes = require('./routes/company');
const pmsRoutes = require('./routes/pms');

const app = express();

// app.use(bodyParser.urlencoded()); // x-www-form-urlencoded <form>
app.use(bodyParser.json()); // application/json
app.use('/images', express.static(path.join(__dirname, 'images')));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST, PUT, PATCH, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});


app.use('/auth', authRoutes);
app.use('/company', companyRoutes);
app.use('/pm', pmsRoutes);
//app.use('/projects', projectRoutes);

app.use((error, req, res, next) => {
    console.log(error);
    const status = error.statusCode || 500;
    const message = error.message;
    res.status(status).json({ message: message });
});

mongoose
    .connect('mongodb://localhost:27017/project'
    )
    .then(result => {
        app.listen(8080);
    })
    .catch(err => console.log(err));