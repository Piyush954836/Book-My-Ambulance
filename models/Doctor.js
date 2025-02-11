const mongoose = require('mongoose');

// Define Doctor schema
const doctorSchema = new mongoose.Schema({
    fullName: {
        type: String,
        required: true, // Ensuring fullName is required
    },
    email: {
        type: String,
        required: true,
        unique: true, // Ensures email is unique
    },
    contact: {
        type: String,
        required: true,
    },
    hospital: {
        type: String,
        required: true,
    },
    password: {
        type: String,
        required: true,
    },
    department: {
        type: String,
        required: true,
    },
    profilePicture: {
        type: {
            data: Buffer,
            contentType: String,
        },
        required: true, // Ensures profilePicture object is required
    },
    status: {
        type: String,
        enum: ['Available', 'Unavailable'],
        default: 'Available'
    }
});

// Export Doctor model
module.exports = mongoose.model('Doctor', doctorSchema);
