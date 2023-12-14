﻿//歌曲播放函数（歌曲MP3）
function MusicPlay(sid) {
    //获取歌曲链接
    if (NeteaseCloudMusicCookie != "") {
        CheckLogin()
    };
    $.getJSON(ColudMusicAPI + "/song/url", { id: sid, realIP: '58.250.174.78', cookie: NeteaseCloudMusicCookie }, function (data) {
      var code = eval(data).data[0].code;
        if (Number(code) == 200) {
            //播放音乐
            var songData = eval(data).data[0].url;
            $("#Music").attr("src", songData);
            oAudio = document.getElementById('Music');
            oAudio.play();
            Play('play');
            //刷新播放按钮
            $("#PlayButtonIcon").empty();
            $("#PlayButtonIcon").append("&#xe651;");
            //获取歌曲信息
            MusicInfo(sid);
        } else {
            TopMsg("歌曲无版权，已切歌", '', true)
            console.log("[常规错误]歌曲无版权")
            before_list.shift(play_list[music_num])
            NextMusic(true,true);
        }
    }).fail(function () {//错误处理
        TopMsg("歌曲播放链接获取失败", '', true)
        console.log("[网络错误]歌曲播放链接获取失败")
    })


}
//歌曲信息获取函数（封面，歌名，艺术家，歌词）
function MusicInfo(sid) {
    $.getJSON(ColudMusicAPI + "/song/detail", { ids: sid, realIP: '58.250.174.78', cookie: NeteaseCloudMusicCookie }, function (data) {
        //歌名
        var nameData = eval(data).songs[0].name;
        $("#SongName").empty();
        $("#SongName").append("" + nameData + "");
        //艺术家
        var artistData = eval(data).songs[0].ar[0].name;
        $("#SongArtist").empty();
        $("#SongArtist").append("" + artistData + "");
        //封面
        var picData = eval(data).songs[0].al.picUrl;
        $("#imgBackground").animate({ height: 'hide' }, 300);
        document.getElementById("SongImg").style.backgroundImage = "url(" + picData + ")";
        $("#imgBackground").animate({ height: 'show' }, 700);
        //更新window控件显示信息
        changeInfo(nameData, artistData, picData)
    }).fail(function () {//错误处理
        TopMsg("歌曲信息获取失败", '', true)
        console.log("[网络错误]歌曲信息获取失败")
    })

    //获取歌词
    //var Music = document.getElementById("Music");
    $.getJSON(ColudMusicAPI + "/lyric", { id: sid, realIP: '58.250.174.78', cookie: NeteaseCloudMusicCookie }, function (data) {
        //清空上一曲的歌词
        $("#LyricText").text("");
        $("#LyricTextTranslation").text("");
        lyric_lines = [0]
        tlyric_lines = [0]
        if (lyric_lines.length != 0) {
            lyric_lines.length = 0
            tlyric_lines.length = 0
        }
        //有无歌词检测
        var uncollected = eval(data).uncollected
        //console.log(uncollected);
        if (uncollected) {
            $("#LyricText").text("暂无歌词");
            $("#LyricTextTranslation").hide()
            $("#LyricHr").hide()
            $("#LyricText").css("top", "50%");
            //console.log("暂无歌词");
        }
        //纯音乐检测
        var nolyric = eval(data).nolyric
        //console.log(nolyric);
        if (nolyric) {
            $("#LyricText").text("纯音乐，请欣赏");
            $("#LyricTextTranslation").hide()
            $("#LyricHr").hide()
            $("#LyricText").css("top", "50%");
            //console.log("纯音乐，请欣赏");
        }
        if ((uncollected != true) && (nolyric != true)) {
            //获取歌词
            var lyric_data = eval(data).lrc.lyric;
            //console.log(lyric_data);
            //是否真的有歌词检测(修网易bug)
            if (lyric_data.length < 30) {
                $("#LyricText").text("暂无歌词");
                $("#LyricTextTranslation").hide()
                $("#LyricHr").hide()
                $("#LyricText").css("top", "50%");
                //console.log("暂无歌词bug");
            }
        }
        //加载翻译
        try {
            var tlyric_data = eval(data).tlyric.lyric;
        }
        catch (err) { }
        //console.log(tlyric_data);
        if (tlyric_data == null || tlyric_data.length <= 10) {
            //翻译检测
            $("#LyricTextTranslation").hide()
            $("#LyricHr").hide()
            $("#LyricText").css("top", "50%");
            //console.log("无翻译");
        } else {
            $("#LyricTextTranslation").show()
            $("#LyricHr").show()
            $("#LyricText").css("top", "unset");
        }
        //console.log("out");

        //使用lrc-file-parser.min.js加载歌词,帮助文档：https://lyswhut.github.io/lrc-file-parser/
        //歌词
        lyric = new Lyric({
            onSetLyric: function (lines) {
                //console.log(lines);
                lyric_lines = lines;
            },
        })
        //翻译
        tlyric = new Lyric({
            onSetLyric: function (lines) {
                //console.log(lines);
                tlyric_lines = lines;
            },
        })
        //字符串处理
        lyric.setLyric(lyric_data)
        tlyric.setLyric(tlyric_data)
        Music.addEventListener("timeupdate", function () {
            //输出歌词
            try {
                var music_time = Music.currentTime * 1000;
                for (var i in lyric_lines) {
                    if (music_time < lyric_lines[0].time) {
                        $("#LyricText").text(lyric_lines[0].text);
                    } else if ((lyric_lines[i - 1 + 2] != null) && (lyric_lines[i].time <= music_time) && (music_time < lyric_lines[i - 1 + 2].time)) {
                        $("#LyricText").text(lyric_lines[i].text);
                        //console.log(i);
                        //console.log(lyric_lines[i].time);
                        //console.log(lyric_lines[i].text);
                        //console.log(lyric_lines);
                    }
                }
            }
            catch (err) {
                console.log("[常规错误]歌词输出有误")
            }
            //输出翻译
            try {
                for (var i in tlyric_lines) {
                    if (music_time < tlyric_lines[0].time) {
                        $("#LyricTextTranslation").text(tlyric_lines[0].text);
                    } else if ((lyric_lines[i - 1 + 2] != null) && (tlyric_lines[i].time <= music_time) && (music_time < tlyric_lines[i - 1 + 2].time)) {
                        $("#LyricTextTranslation").text(tlyric_lines[i].text);
                    }
                }
            }
            catch (err) {
                console.log("[常规错误]翻译输出有误")
            }
            //console.log(Music.currentTime);
        })
    }).fail(function () {//错误处理
        TopMsg("歌词获取失败", '', true)
        console.log("[网络错误]歌词获取失败")
    })
}
//播放三角形切换
function PlayIconChange(songId) {
    $(".songListCell").find(".songListIcon").hide();
    $("#SongListCell" + songId).children(".songListIcon").show()
    //document.getElementById("SongListCell" + songId).scrollIntoView()
}