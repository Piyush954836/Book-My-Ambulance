// models/User.js
const mongoose = require('mongoose');

// Define the User schema
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    username: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    password: {
        type: String,
        required: true,
    },
    latitude: {
        type: Number,
        default: null
    },
    longitude: {
        type: Number,
        default: null
    }
}, { timestamps: true });

// Export the model based on the schema
module.exports = mongoose.model('User', userSchema);
