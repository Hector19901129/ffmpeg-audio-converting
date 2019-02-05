var express = require('express');
var path = require("path");
var bodyParser = require("body-parser");
var ffmpeg = require('fluent-ffmpeg');

var app = express();

process.env.LOCAL_PATH = "input/"
process.env.DOWNLOAD_PATH = "C:/Users/Gwen/Downloads/"; //set download path correctly
process.env.OUTPUT_FILEPATH = "output/";
process.env.FREQUENCY = 8000;

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', function (req, res) {
  res.sendFile(__dirname + '/index.html');
});
app.post('/convert', function(req, res) {
    console.log('receiving data ...');
    convertToWav(process.env.DOWNLOAD_PATH + req.body.input_file, process.env.OUTPUT_FILEPATH + req.body.input_file);
    
});
app.post('/convertFromLocal', function(req, res) {
    console.log('receiving data ...');
    console.log(req.body);
    convertToWav(process.env.LOCAL_PATH + req.body.input_file, req.body.output_file);
    
    return "200";
});

app.listen(3000, function() {
  console.log("server going");
});

function convertToWav(file,output) {
    var audioBitRateFor100mbSize='2';
    var aud_file =  output;
    var comand = ffmpeg(file)
                    .noVideo()
                    .audioCodec('pcm_s16le')
                    .audioChannels(1)
                    .audioFrequency(process.env.FREQUENCY)
                    .audioBitrate(audioBitRateFor100mbSize, true)
                    .output(aud_file)
                    .on('progress', function(progress) {
                        console.log('Processing: ' + progress.timemark + ' done ' + progress.targetSize+' kilobytes');
                    })
                    .on('end', function() {
                            console.log('Finished processing');
                            ffmpeg(output)
                            .ffprobe(function(err, data) {
                            console.log(output + ' metadata:');
                            console.dir(data);
                            });
                        }
                    ).run();               
}