"use strict";
var _ = require("underscore");

var d_data = {
  bin:"youtube-dl",
  "dld_pattern":"download/%(title)s - %(id)s - %(autonumber)s.%(ext)s"
};
var exec = require('child_process').exec,
  spawn = require('child_process').spawn,
  child;

var YoutubeDl = function(data) {

  data = _.defaults(data, d_data);

  this.get_information = function(url,then){
    var args = [url];
    args.push("-j")
    console.log(data.bin,args.join(" "));
    child = exec(data.bin+' '+args.join(" "),
      function (error, stdout, stderr) {
        var r = {
          url:url,
          upload_date:"",
          fulltitle:"",
          thumbnail:"",
          description:"",
          webpage_url:"",
          formats:[],
          extractor:""
        };
        if (error !== null) {
          console.log('exec error: ' + error);
        }else{

          stdout = stdout.split("\n");
          for( var n in stdout ){
            r = JSON.parse(stdout[n]);
            for( var nn in r.formats ){
              if( r.formats[nn].format_id ){
                r.formats[nn] = r.formats[nn].format_id;
              }
            }
            break;
          }
          if( ! r.files ) r.files = [];
          for( var n in stdout ){
            try{
              var t = JSON.parse(stdout[n]);
              r.files.push({
                filename:t._filename
              });
            }catch(ex){
              console.log(stdout[n])
            }
          }
        }
        if( then ) then(error,r,stderr);
      });
  };

  this.start_download = function(url,options){
    var args = [url];
    if( options.format ){
      args.push("-f")
      args.push(options.format)
    }
    if( options.audio_only ){
      args.push("--extract-audio")
    }
    if( options.force_restart ){
      args.push("--no-continue")
    }
    if( options.embed_thumbnail ){
      args.push("--embed-thumbnail")
    }
    if( options.output ){
      args.push("--output")
      args.push(options.output)
    }else if( data.dld_pattern ){
      args.push("-o")
      args.push(data.dld_pattern)
    }
    console.log(data.bin,args.join(" "));
    return spawn(data.bin,args);
  };
}

module.exports = YoutubeDl;