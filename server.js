const express = require('express');
const multer = require('multer');
require('dotenv').config();
const { v4: uuid } = require("uuid");
const app = express();
const AWS = require('aws-sdk');
var path = require('path');
const { response, request } = require('express');

// 
app.use(express.static("./templates"));
app.set('view engine', 'ejs');
app.set('views', './templates');

// 

AWS.config.update({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
    region: process.env.REGION
})

const docClient = new AWS.DynamoDB.DocumentClient();

const tblName = "tblSanPham";
// config s3

const s3 = new AWS.S3({
    accessKeyId: process.env.ACCESS_KEY_ID,
    secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

// 
const storage = multer.memoryStorage({
    destination(req, file, callback) {
        callback(null, '')
    }
})

function checkFileType(file, cb) {
    const fileTypes = /jpeg|jpg|png|gif/;

    const extname = fileTypes.test(path.extname(file.originalname).toLocaleLowerCase());
    const minetype = fileTypes.test(file.mimetype);

    if (extname && minetype) {
        return cb(null, true);
    }

    return cb("Error: Image Only");

}

const upload = multer({
    storage,
    limits: { fileSize: 2000000 }, //2MB
    fileFilter(req, file, cb) {
        checkFileType(file, cb);
    },
});
//
const CLOUD_FRONT_URL = 'https://d16oshxfoau09o.cloudfront.net/';


//
app.get('/', (req, res) => {
    const params = {
        TableName: tblName,
    };

    docClient.scan(params, (err, data) => {
        if (err) {
            return res.send("Internal Server Error");
        } else {
            // console.log('data = ', JSON.stringify(data))
            return res.render('index', { sanPhams: data.Items });
        }
    });
})

app.get('/update', (req, res) => {
    // const { ma_sp } = req.body;
    console.log("🚀 ~ file: server.js ~ line 49 ~ app.get ~ req.body", req.body);

    return res.redirect("/");
    docClient.scan((err, data) => {
        console.log("🚀 ~ file: server.js ~ line 51 ~ docClient.scan ~ data", data)
        return res.render('form', { sanPham: data.ma_sp });
    })
})

app.post('/', upload.single('image'), (req, res) => {
    const { ma_sp, ten_sp, so_luong } = req.body;

    const image = req.file.originalname.split('.');

    const fileType = image[image.length - 1];

    const filepath = `${uuid() + Date.now().toString()}.${fileType}`;

    const params = {
        Bucket: "uploads3-bucket-avan",
        Key: filepath,
        Body: req.file.buffer
    }

    s3.upload(params, (error, data) => {
        if (error) {
            console.log('err(110) = ', error);
            return res.send("Internal Server Error");
        } else {
            const newItem = {
                TableName: tblName,
                Item: {
                    "ma_sp": ma_sp,
                    "ten_sp": ten_sp,
                    "so_luong": so_luong,
                    "image_url": `${CLOUD_FRONT_URL}${filepath}`
                }

            }
            docClient.put(newItem, (err, data) => {
                if (err) {
                    console.log('err(126) = ', error);
                    return res.send("Internal Server Error");
                } else {
                    return res.redirect("/");
                }
            })
        }
    })

});

app.post("/delete", upload.single('image'), (req, res) => {

    const { ma_sp } = req.body;
    const params = {
        TableName: tblName,
        Key: {
            ma_sp
        }
    }

    docClient.delete(params, (err, data) => {
        if (err) {
            console.log("🚀 ~ file: server.js ~ line 79 ~ docClient.put ~ err", err);
            return res.send("err ---- /delete");
        } else {
            return res.redirect("/");
        }
    });

});

app.listen(8981, () => {
    console.log(`Example app listening on port 8981`)
})