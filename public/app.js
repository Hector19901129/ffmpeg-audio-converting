//webkitURL is deprecated but nevertheless
URL = window.URL || window.webkitURL;

var gumStream; //stream from getUserMedia()
var rec; //Recorder.js object
var input; //MediaStreamAudioSourceNode we'll be recording

// shim for AudioContext when it's not avb. 
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioContext //audio context to help us record

var recordButton = document.getElementById("recordButton");
var stopButton = document.getElementById("stopButton");
var pauseButton = document.getElementById("pauseButton");
var convertFromGivenFileButton = document.getElementById("convertFromGivenFileButton");
//add events to those 2 buttons
recordButton.addEventListener("click", startRecording);
stopButton.addEventListener("click", stopRecording);
pauseButton.addEventListener("click", pauseRecording);


convertFromGivenFileButton.addEventListener("click", convertFromGivenFile);
function startRecording() {
  console.log("recordButton clicked");

  /*
  	Simple constraints object, for more advanced audio features see
  	https://addpipe.com/blog/audio-constraints-getusermedia/
  */

  var constraints = {
    audio: true,
    video: false
  }

  /*
    	Disable the record button until we get a success or fail from getUserMedia() 
	*/

  recordButton.disabled = true;
  stopButton.disabled = false;
  pauseButton.disabled = false

  /*
    	We're using the standard promise based getUserMedia() 
    	https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
	*/

  navigator.mediaDevices.getUserMedia(constraints).then(function (stream) {
    console.log("getUserMedia() success, stream created, initializing Recorder.js ...");

    /*
    	create an audio context after getUserMedia is called
    	sampleRate might change after getUserMedia is called, like it does on macOS when recording through AirPods
    	the sampleRate defaults to the one set in your OS for your playback device

    */
    audioContext = new AudioContext();

    //update the format 
    document.getElementById("formats").innerHTML = "Format: 1 channel pcm @ " + audioContext.sampleRate / 1000 + "kHz"

    /*  assign to gumStream for later use  */
    gumStream = stream;

    /* use the stream */
    input = audioContext.createMediaStreamSource(stream);

    /* 
    	Create the Recorder object and configure to record mono sound (1 channel)
    	Recording 2 channels  will double the file size
    */
    rec = new Recorder(input, {
      numChannels: 1
    })

    //start the recording process
    rec.record()

    console.log("Recording started");

  }).catch(function (err) {
    //enable the record button if getUserMedia() fails
    recordButton.disabled = false;
    stopButton.disabled = true;
    pauseButton.disabled = true
  });
}

function pauseRecording() {
  console.log("pauseButton clicked rec.recording=", rec.recording);
  if (rec.recording) {
    //pause
    rec.stop();
    pauseButton.innerHTML = "Resume";
  } else {
    //resume
    rec.record()
    pauseButton.innerHTML = "Pause";

  }
}

function stopRecording() {
  console.log("stopButton clicked");

  //disable the stop button, enable the record too allow for new recordings
  stopButton.disabled = true;
  recordButton.disabled = false;
  pauseButton.disabled = true;

  //reset button just in case the recording is stopped while paused
  pauseButton.innerHTML = "Pause";

  //tell the recorder to stop the recording
  rec.stop();

  //stop microphone access
  gumStream.getAudioTracks()[0].stop();

  var t = rec.getBuffer(bufferCallBack);
  console.log(t)
  //create the wav blob and pass it on to createDownloadLink
  rec.exportWAV(createDownloadLink);
}
//newlly added
function convertFromGivenFile(){
    if($('input[type=file]').val().replace(/C:\\fakepath\\/i, '') == ''){
      alert("Choose input audio file to convert please.");
      return;
    }
    if($("#filePath").val() == ''){
      alert("Type file path string to be converted.");
      return;
    }
    var input_file = $('input[type=file]').val().replace(/C:\\fakepath\\/i, '');
    var output_file = $("#filePath").val();
    $.post("/convertFromLocal", {"input_file": input_file, "output_file": output_file}, function(data){
      
    });
    alert("successfully converted");
}

function bufferCallBack(data) {
  console.log(data)
  var context = new AudioContext();
  var c = new OfflineAudioContext(1, data.length, 8000);
  var b = c.createBuffer(1, data.length, 8000);
  var data2 = new Float32Array(data);
  b.copyToChannel(data2, 0);
  var s = c.createBufferSource();
  s.buffer = b;

  c.startRendering().then(function (result) {
    console.log(result)
    make_download(result, c.length);
  });
  return;
}

function make_download(abuffer, total_samples) {

  // get duration and sample rate
  var duration = abuffer.duration,
    rate = abuffer.sampleRate,
    offset = 0;

  var new_file = URL.createObjectURL(bufferToWave(abuffer, total_samples));

  var download_link = document.getElementById("download_link");
  download_link.href = new_file;
  var name = generateFileName();
  download_link.download = name;
}
function generateFileName() {
  return "test.compressed.wav";
}
function bufferToWave(abuffer, len) {
  var numOfChan = abuffer.numberOfChannels,
    length = len * numOfChan * 2 + 44,
    buffer = new ArrayBuffer(length),
    view = new DataView(buffer),
    channels = [],
    i, sample,
    offset = 0,
    pos = 0;

  // write WAVE header
  setUint32(0x46464952); // "RIFF"
  setUint32(length - 8); // file length - 8
  setUint32(0x45564157); // "WAVE"

  setUint32(0x20746d66); // "fmt " chunk
  setUint32(16); // length = 16
  setUint16(1); // PCM (uncompressed)
  setUint16(numOfChan);
  setUint32(abuffer.sampleRate);
  setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
  setUint16(numOfChan * 2); // block-align
  setUint16(16); // 16-bit (hardcoded in this demo)

  setUint32(0x61746164); // "data" - chunk
  setUint32(length - pos - 4); // chunk length

  // write interleaved data
  for (i = 0; i < abuffer.numberOfChannels; i++)
    channels.push(abuffer.getChannelData(i));

  while (pos < length) {
    for (i = 0; i < numOfChan; i++) { // interleave channels
      sample = Math.max(-1, Math.min(1, channels[i][offset])); // clamp
      sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0; // scale to 16-bit signed int
      view.setInt16(pos, sample, true); // write 16-bit sample
      pos += 2;
    }
    offset++ // next source sample
  }

  // create Blob
  return new Blob([buffer], {
    type: "audio/wav"
  });

  function setUint16(data) {
    view.setUint16(pos, data, true);
    pos += 2;
  }

  function setUint32(data) {
    view.setUint32(pos, data, true);
    pos += 4;
  }
}

function createDownloadLink(blob) {

  var url = URL.createObjectURL(blob);
  var au = document.createElement('audio');
  var li = document.createElement('li');
  var link = document.createElement('a');

  var now = new Date();

  var filename = now.getFullYear().toString() + now.getMonth().toString() + now.getDate().toString() + now.getHours().toString() + now.getMinutes().toString() + now.getSeconds().toString();

  //add controls to the <audio> element
  au.controls = true;
  au.src = url;

  //save to disk link
  link.href = url;
  link.download = filename + ".wav"; //download forces the browser to donwload the file using the  filename
  link.innerHTML = "Save to disk | ";

  //add the new audio element to li
  li.appendChild(au);

  //add the filename to the li
  li.appendChild(document.createTextNode(filename + ".wav "))
  link.click();
  //add the save to disk link to li
  //li.appendChild(link);

  //upload link
  var upload = document.createElement('a');
  upload.href = "#";
  upload.innerHTML = "Upload | ";
  upload.addEventListener("click", function (event) {
    var xhr = new XMLHttpRequest();
    xhr.onload = function (e) {
      if (this.readyState === 4) {
        console.log("Server returned: ", e.target.responseText);
      }
    };
    var fd = new FormData();
    fd.append("audio_data", blob, filename);
    xhr.open("POST", "upload.php", true);
    xhr.send(fd);
  })
  li.appendChild(document.createTextNode(" ")) //add a space in between
  li.appendChild(upload) //add the upload link to li
  
  // newly added
  var download_file = document.createElement('a');
  download_file.href = "#";
  download_file.innerHTML = "Save Converted file";
  download_file.addEventListener("click", function (event) {
    $.post("/convert", {"input_file": filename + ".wav"}, function(data){
      
    });
    alert(filename + ".wav is successfully saved in output folder.");
  });
  li.appendChild(document.createTextNode(" ")); //add a space in between
  li.appendChild(download_file);


  //add the li element to the ol
  recordingsList.appendChild(li);
}



