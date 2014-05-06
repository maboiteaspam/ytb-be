

// gives an api to quickly
// programaticaly stop / start
// a back end server for ytb-wfe

var Download = require("./lib/Download.js");
var YoutubeDl = require("./lib/youtube-dl-cli.js");
var _ = require("underscore");
var express = require('express');
var http = require('http');
var fs = require('fs');

var d_options = {
  hostname:"localhost", // 0.0.0.0 to listen external interface
  port:3001,
  run_path:".run",
  allowOrigins:[]
};

var YtbBe = function(options) {

  options = _.defaults(options, d_options);

  if( fs.existsSync(options.run_path) == false ){
    fs.mkdirSync(options.run_path);
  }

  var server;
  var app = express();
  var controlAccessOrigin = function(req,res,next){
    for( var n in options.allowOrigins ){
      var o = options.allowOrigins[n];
      if(o==req.get('Origin')){
        res.set('Access-Control-Allow-Origin', ''+o+'');
      }
    }
    next();
  };
  app.use(controlAccessOrigin);

  var ytb_dlder_opt = {};
  if( options.bin ) ytb_dlder_opt.bin = options.bin;
  if( options.dld_pattern ) ytb_dlder_opt.dld_pattern = options.dld_pattern;
  var ytbdlder = new YoutubeDl(ytb_dlder_opt);
  var downloads = [];
  var loadDownloads = function(){
    var r = [];
    var file = options.run_path+"/downloads.json";
    if( fs.existsSync(file) ){
      var c = fs.readFileSync(file,'utf8');
      var items = JSON.parse( c );
      for( var n in items ){
        r.push( new Download(items[n]) );
      }
    }
    return r;
  };
  var _del;
  var writeDownloads = function(downloads){
    clearTimeout(_del);
    setTimeout(function(){
      fs.writeFileSync(options.run_path+"/downloads.json",JSON.stringify(downloads,null,4));
    },500);
  };
  var findByUrl = function(downloads,url){
    for( var n in downloads ){
      if( downloads[n].webpage_url == url ){
        return downloads[n];
      }
    }
  };
  var removeByUrl = function(downloads,url){
    var r = [];
    for( var n in downloads ){
      if( downloads[n].webpage_url != url ){
        r.push( downloads[n] );
      }
    }
    return r;
  };
  var exportable = function(downloads){
    var r = [];
    for( var n in downloads ){
      r.push( downloads[n].export() );
    }
    return r;
  };
  downloads = loadDownloads();

  app.get('/information', function(req, res){
    var url = req.query.url;
    var dl = findByUrl(downloads,url);
    if( dl ){
      res.json(dl.export());
    }else{
      console.info("fetching "+url)
      ytbdlder.get_information(url,function(err,dl,stderr){
        dl = new Download(dl);
        if( err ){
          dl.errors.push("wrong url format");
        }
        downloads.push(dl)
        writeDownloads(exportable(downloads));
        res.json(dl.export());
      });
    }
  });
  app.get('/list', function(req, res){
    res.json({
      items:exportable(downloads)
    });
  });
  app.get('/download', function(req, res){
    var url = req.query.url;

    var dl = findByUrl(downloads,url);
    if( ! dl ){
      dl = new Download({
        url:url
      });
      downloads.push( dl );
    }
    if( req.query.audio_only=="true" )  dl.audio_only = true;
    if( req.query.audio_only=="false" ) dl.audio_only = false;

    if( req.query.force_restart=="true" )   dl.force_restart = true;
    if( req.query.force_restart=="false" )  dl.force_restart = false;

    if( req.query.format+"" != "" )   dl.format = req.query.format;

    if( dl.process ){
      dl.process.on("exit",function(){
        dl.attach_process(
          ytbdlder.start_download(url,dl)
        );
      });
      dl.kill_process();
    }else{
      dl.attach_process(
        ytbdlder.start_download(url,dl)
      );
    }

    writeDownloads(exportable(downloads));
    res.json({
      items:exportable(downloads)
    });
  });
  app.get('/stop', function(req, res){
    var url = req.query.url;

    var dl = findByUrl(downloads,url);
    if( dl ){
      dl.kill_process();
      dl.status = "stopped";
    }

    res.json({
      items:exportable(downloads)
    });
  });
  app.get('/trash', function(req, res){
    var url = req.query.url;

    var dl = findByUrl(downloads,url);
    if( dl ){
      if( dl.process ){
        dl.process.on("close",function(){
          dl.process = null;
        });
        dl.process.kill('SIGINT');
      }
    }
    downloads = removeByUrl(downloads,url);
    writeDownloads(exportable(downloads));
    res.json({
      items:exportable(downloads)
    });
  });

  this.start = function(then){
    server = http.createServer(app).listen(options.port,options.hostname,null,then);
  };
  this.stop = function(then){
    server.close(); // odd, after first client query, callback is not called anymore
    if( then ) then(); // have to trigger it manually here
  };
};
module.exports = YtbBe;