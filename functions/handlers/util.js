const admin = require("firebase-admin");
const fs = require("fs").promises;
const path = require("path");
const nodemailer = require('nodemailer');
const { VertexAI } = require('@google-cloud/vertexai');

if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();
const bucket = admin.storage().bucket('robotiax.appspot.com');
const modelAI = 'gemini-2.5-flash';

let vertexAIInstance;
const getVertexAI = () => {
    if (!vertexAIInstance) {
        vertexAIInstance = new VertexAI({ 
            project: process.env.GCLOUD_PROJECT || 'robotiax', 
            location: 'us-central1' 
        });
    }
    return vertexAIInstance;
};

let transporter;
const getTransporter = () => {
    if (!transporter) {
        transporter = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: {
                user: 'geniosdeltalento@gmail.com',
                pass: 'bcnmvqwyvfkhxpxd'
            },
            tls: { rejectUnauthorized: false }
        });
    }
    return transporter;
};

async function loadAsset(filePath) {
    try {
        return await fs.readFile(path.join(__dirname, '..', filePath), 'utf8');
    } catch (e) {
        console.warn(`Asset no encontrado: ${filePath}`);
        return "";
    }
}

module.exports = { db, bucket, getVertexAI, getTransporter, loadAsset, modelAI };