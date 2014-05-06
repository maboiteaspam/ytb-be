"use strict";
var _ = require("underscore");
var moment = require("moment");

var d_data = {
  formats:[],
  process:null,
  audio_only:false,
  format:"",
  extractor:"",
  display_id:"",
  webpage_url:"",
  description:"",
  thumbnail:"",
  upload_date:"",
  fulltitle:"",
  url:"",
  filename:"",
  status:"stopped",
  eta:"-",
  speed:"-",
  achieved:"0%",
  file_size:"-",
  last_update_time:moment().unix(),
  inactivity_time:0,
  errors:[],
  files:[]
};

var Download = function(data) {
  var that = this;

  data = _.defaults(data, d_data);

  for( var n in d_data ){
    if( data[n] !== undefined ){
      that[n] = data[n];
    }else{
      that[n] = d_data[n];
    }
  }
  if( ! data.formats.length && data.format ) that.formats.push(data.format);
  if( !data.filename && data.files.length > 0 ){
    that.filename = data.files[0].filename;
  }
  that.export = function(){
    var resources = ["process"];
    var o = {};
    for( var n in d_data ){
      if( resources.indexOf(n) == -1 ){
        o[n] = that[n];
      }
      o.inactivity_time = moment().unix()-that.last_update_time;
    }
    return o;
  };

  var update_file_status = function(filename, props){
    /*
     assume props is a struct such
     { speed, eta, achieved, file_size }
     */
    for( var n in that.files ){
      var f = that.files[n];
      if( f.filename == filename ){
        for( var nn in props ){
          f[nn] = props[nn];
        }
        return true;
      }
    }
    return false;
  };
  var update_current_file_status = function(){
    if( ! update_file_status(that.filename,{
      status:that.status,
      speed:that.speed,
      eta:that.eta,
      achieved:that.achieved,
      file_size:that.file_size
    }) ){
      that.files.push({
        status:that.status,
        filename:that.filename,
        speed:that.speed,
        eta:that.eta,
        achieved:that.achieved,
        file_size:that.file_size
      })
    }
  };
  var are_they_all_downloaded = function(){
    for( var n in that.files ){
      var f = that.files[n];
      if( f.status != 'downloaded' ){
        return false;
      }
    }
    return true;
  };

  /*
   [provider] display_id: Downloading webpage
   [provider] display_id: Extracting information
   [info] Writing video description metadata as JSON to: 24小时 第一季 01-XMzE1NjQ3NDky_part00.info.json
   [download] Destination: 24小时 第一季 01-XMzE1NjQ3NDky_part00.flv
   [download]  67.3% of 11.88MiB at  1.96MiB/s ETA 00:01
   ERROR: Interrupted by user
   */
  var sequence = {
    'declare':{
      pattern:/\[([a-z0-9_.+:]+)\]\s+([^:]+):\s+Downloading webpage/i,
      handle:function( matches ){
        that.inactivity_time = 0;
        that.errors = [];
        that.status = "loading";
        that.provider = matches[1];
        that.display_id = matches[2];
      }
    },
    'start':{
      pattern:/\[download\]\s+Destination:\s+(.+)/i,
      handle:function( matches ){
        that.status = "starting";
        that.filename = matches[1];
        update_current_file_status();
      }
    },
    'download':{
      pattern:/\[download\]\s+([0-9.%]+)\s+of\s+~?([0-9.GMKib]+)\s+at\s+([0-9./MKibs-]+)\s+ETA\s+(.+)/i,
      handle:function( matches ){
        that.errors = [];
        that.status = "downloading";
        that.achieved = matches[1];
        that.file_size = matches[2];
        that.speed = matches[3];
        that.eta = matches[4];
        update_current_file_status();
      }
    },
    'downloaded':{
      pattern:/\[download\]\s+[0-9.]+%\s+of\s+([~0-9.MKib]+)\s+in\s+([0-9:]+)/i,
      handle:function( matches ){
        that.errors = [];
        that.status = "downloaded";
        that.achieved = "100%";
        that.file_size = matches[1];
        that.eta = matches[2];
        update_current_file_status();
        that.status = are_they_all_downloaded()?"downloaded":"downloading";
      }
    },
    'rtmp_dump':{
      pattern:/\[rtmpdump] [0-9] bytes/i,
      handle:function( matches ){
        that.errors = [];
        that.status = "downloaded";
        that.achieved = "100%";
        that.file_size = matches[1];
        that.eta = matches[2];
        update_current_file_status();
        that.status = are_they_all_downloaded()?"downloaded":"downloading";
      }
    },
    'already_downloaded':{
      pattern:/\[download\]\s+(.+)\s+has already been downloaded/i,
      handle:function( matches ){
        that.errors = [];
        that.filename = matches[1];
        that.status = "downloaded";
        that.achieved = "100%";
        update_current_file_status();
        that.status = are_they_all_downloaded()?"downloaded":"downloading";
      }
    },
    'interupt':{
      pattern:/ERROR: (Interrupted by user)/i,
      handle:function( matches ){
        that.status = "stopped";
        that.speed = "-";
        that.eta = "-";
        that.errors.push(matches[1]);
      }
    },
    'timeout':{
      pattern:/ERROR: (unable to download video data: timed out)/i,
      handle:function( matches ){
        that.status = "stopped";
        that.speed = "-";
        that.eta = "-";
        that.errors.push(matches[1]);
      }
    },
    'error':{
      pattern:/ERROR: (.+)/i,
      handle:function( matches ){
        that.status = "stopped";
        that.speed = "-";
        that.eta = "-";
        that.errors.push(matches[1]);
      }
    }
  };


  that.attach_process = function(process){
    that.errors = [];
    that.files = [];
    that.process = process;
    that.process.stdout.on('data', function (data) {
      data = ""+data;
      var matches;
      for( var n in sequence ){
        var seq = sequence[n];
        matches = data.match( seq.pattern );
        if( matches ){
          seq.handle(matches);
          that.last_update_time = moment().unix();
          if( n != 'download' /* too much logs */ )console.log('-'+n+'-'+that.filename+" "+that.webpage_url);
          break;
        }
      }
      if( !matches ){
        console.log('stdout: ' + data+"");
      }
    });
    that.process.stderr.on('data', function (data) {
      data = ""+data;
      var matches;
      for( var n in sequence ){
        var seq = sequence[n];
        matches = data.match( seq.pattern );
        if( matches ){
          seq.handle(matches);
          that.last_update_time = moment().unix();
          console.log('-'+n+'-'+that.webpage_url+"");
          break;
        }
      }
      if( !matches ){
        console.log('stderr: ' + data+"");
      }
    });
    that.process.on('exit', function () {
      that.process = null;
    });
  };
  that.kill_process = function(){
    if( that.process ){
      that.process.kill('SIGINT');
    }
  };


  if( that.process ){
    that.attach_process( that.process );
  }

}

module.exports = Download;