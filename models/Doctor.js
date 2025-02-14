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
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Hospital',  // Linking to the Hospital model
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
    },
    shift: {
        type: String,
        enum: ['Day', 'Night'], // Assigning shift timing
        required: true,
    }
}, { timestamps: true });

// Export Doctor model
module.exports = mongoose.model('Doctor', doctorSchema);
