
ytb-be
========

A backend for youtube-dl accessible thru a simple api.
Consider using ytb-wui to use it out-of-the-box.


Exposed api
========

/information?url=<url>
url: URL of the webpage to download the video
Retrieve information of an url and returns a JSON feed.

/list
Retrieve lists of downloads as a JSON feed.

/start?url=<url>&audio_only=false&force_restart=false&format=
audio_only = true|false
force_restart = true|false
format = "" One of the format found in information.
Start download of an url and return updated list of downloads.

/stop?url=<url>
url: URL of the download to stop
Stop a download, returns updated list of downloads.

/trash?url=<url>
url: URL of the download to trash
Trash a download, returns updated list of downloads.

/download?url=<url>
url: URL of the download to send
Send video file to download for user.

/stream?url=<url>
url: URL of the download to stream
Stream a download