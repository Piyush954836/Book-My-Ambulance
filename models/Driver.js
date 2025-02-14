const mongoose = require('mongoose');

// Define Driver schema
const driverSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true, // Correct use of required
    },
    email: {
        type: String,
        required: true,  // Correct use of required
        unique: true
    },
    contactNumber: {
        type: String,
        required: true,  // Correct use of required
    },
    age: {
        type: Number,
        required: true,  // Correct use of required
        min: 18
    },
    password: {
        type: String,
        required: true,  // Correct use of required
    },
     hospital: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Hospital',  // Linking to the Hospital model
            required: true,
        },
    drivingLicensePhoto: {
        data: {
            type: Buffer, // Correctly specifying the type for the buffer
            required: true, // Required field (correct placement)
        },
        contentType: {
            type: String,  // Correct type for content type
            required: true, // Correct use of required for content type
        }
    },
    isActive: { type: Boolean, default: false },
    location: {
        latitude: Number,
        longitude: Number
    },
    shift: {
        type: String,
        enum: ['Day', 'Night'], // Assigning shift timing
        required: true,
    }
});

// Export the model for Driver schema, using the correct driverDB connection
module.exports = mongoose.model('Driver', driverSchema);
