

// gives an api to quickly
// programaticaly stop / start
// a back end server for ytb-wfe

var Download = require("./lib/Download.js");
var YoutubeDl = require("./lib/youtube-dl-cli.js");
var _ = require("underscore");
var express = require('express');
var http = require('http');
var fs = require('fs');

// default options for that server
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

  // Enable CORS
  app.all('*', function(req, res, next) {
    for( var n in options.allowOrigins ){
      var o = options.allowOrigins[n];
      if(o==req.get('Origin') || o == "*" ){
        res.set('Access-Control-Allow-Credentials', 'true');
        res.set('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        res.set('Access-Control-Allow-Origin', ''+o+'');
        res.set("Access-Control-Allow-Headers", "X-Requested-With");
        return next();
      }
    }
    return next();
  });

  // configure youtube-dl binary wrapper
  var ytb_dlder_opt = {};
  if( options.bin ) ytb_dlder_opt.bin = options.bin;
  if( options.dld_pattern ) ytb_dlder_opt.dld_pattern = options.dld_pattern;
  var ytbdlder = new YoutubeDl(ytb_dlder_opt);

  // the list of downloads (in memory)
  var downloads = [];
  // the lists of saved downloads (on disk)
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

  // helpers to manipulate download items
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

  // delay saves of the downloads on disk to avoid corruption
  // not sure it is really useful
  var _del;
  var writeDownloads = function(downloads){
    clearTimeout(_del);
    setTimeout(function(){
      fs.writeFileSync(options.run_path+"/downloads.json",JSON.stringify(downloads,null,4));
    },500);
  };

  // int downloads
  downloads = loadDownloads();

  // return information about a video url
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
  // return the list of downloads saved
  app.get('/list', function(req, res){
    res.json({
      items:exportable(downloads)
    });
  });
  // start and save download
  app.get('/download', function(req, res){
    var url = req.query.url;

    // find existing download
    // or create a new one
    var dl = findByUrl(downloads,url);
    if( ! dl ){
      dl = new Download({
        url:url
      });
      downloads.push( dl );
    }

    // configure download options
    if( req.query.audio_only=="true" )  dl.audio_only = true;
    if( req.query.audio_only=="false" ) dl.audio_only = false;

    if( req.query.force_restart=="true" )   dl.force_restart = true;
    if( req.query.force_restart=="false" )  dl.force_restart = false;

    if( req.query.format+"" != "" )   dl.format = req.query.format;

    // if it seems already started
    // restart it
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

    // respond downloads in proper format
    var exported = exportable(downloads);
    writeDownloads(exported);
    res.json({
      items:exported
    });
  });
  // stop a download.
  app.get('/stop', function(req, res){
    var url = req.query.url;

    var dl = findByUrl(downloads,url);
    if( dl ){
      dl.kill_process();
      dl.status = "stopped";
    }

    var exported = exportable(downloads);
    res.json({
      items:exported
    });
  });
  // trash a download
  // stop process
  // remove it from download lists
  // eventually
  // delete the files
  app.get('/trash', function(req, res){
    var url = req.query.url;

    var dl = findByUrl(downloads,url);
    if( dl ){
      if( dl.process ){
        dl.process.on("close",function(){
          dl.process = null;
        });
        dl.kill_process();
      }
    }
    // explicitly do not wait for process end, return immediately.
    downloads = removeByUrl(downloads,url);
    var exported = exportable(downloads);
    writeDownloads(exported);
    res.json({
      items:exported
    });
  });

  // public methods.
  this.start = function(then){
    server = http.createServer(app).listen(options.port,options.hostname,null,then);
  };
  this.stop = function(then){
    server.close(); // odd, after first client query, callback is not called anymore
    if( then ) then(); // have to trigger it manually here
  };
};
module.exports = YtbBe;