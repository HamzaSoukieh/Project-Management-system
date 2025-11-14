const mongoose = require('mongoose');

function connectDB() {
    return mongoose.connect(process.env.MONGO_URI, {
        // no need for options in newer mongoose
    });
}

module.exports = connectDB;
