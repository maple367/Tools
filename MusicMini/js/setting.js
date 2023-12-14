//API地址
var ColudMusicAPI = "https://netease-cloud-music-api.maple367.eu.org";
var BiliDanMuAPI = "https://blc-proxy.maple367.eu.org/xlive/web-room/v1/dM/gethistory";

//房间绑定
var RoomID = "383975";
$(document).ready(function () {
    $("#LiveRoomNumInputButton").click(function () {
        RoomID = ($("#LiveRoomNumInput").val());
        //console.log(RoomId);
        if (RoomID == "") {
            $("#LiveRoomNumInput").val("");
            $("#LiveRoomNumInput").attr("placeholder", "请输入房间号");
        } else {
            $("#LiveRoomNumInput").val("");
            $("#LiveRoomNumInput").attr("placeholder", "已绑定房间" + RoomID);
        }
    })
})
//弹幕控制
var DanmuCtrlSwich = true;
$(document).ready(function () {
    $("#DanmuCtrlSwichDiv").click(function () {
        DanmuCtrlSwich = $("#DanmuCtrlSwich").is(":checked");
        //console.log(DanmuCtrlSwich);
    })
})
//弹幕点歌
var DanmuOrderSwich = true;
$(document).ready(function () {
    $("#DanmuOrderSwichDiv").click(function () {
        DanmuOrderSwich = $("#DanmuOrderSwich").is(":checked");
        //console.log(DanmuOrderSwich);
    })
})
//播放模式
var PlayMode = 0;
$(document).ready(function () {
    $("#PlayModeCheck").click(function () {
        PlayMode = $("#PlayModeCheck").find("option:selected").attr("value");
        //console.log(PlayMode);
    })
    $("#PlayModeButton").click(function () {
        var i = $("#PlayModeCheck").find("option:selected").attr("value");
        if (i >= 2) {
            PlayModeChange(0)
        } else {
            PlayModeChange(++i)
        }
    })
})
function PlayModeChange(mode) {
    if ((mode >= 0) && (mode <= 2)) {
        PlayMode = mode;
        var option = document.getElementById("PlayModeCheck").getElementsByTagName("option");
        option[mode].selected = true;
    } else {
        TopMsg("播放模式有误", '', true)
        console.log("[参数错误]播放模式有误")
    }
}
//登录
var NeteaseCloudMusicCookie = "";
$(document).ready(function () {
    $("#NeteaseCloudMusicLoginButton").click(function () {
        var PhoneNum = prompt("请输入手机号", "");
        if (PhoneNum != null && PhoneNum != "") {
            $.getJSON(ColudMusicAPI + "/captcha/sent", { phone: PhoneNum }, function (data) {
                if (data.code == 200) {
                    var Captcha = prompt("请输入验证码", "");
                    if (Captcha != null && Captcha != "") {
                        $.getJSON(ColudMusicAPI + "/login/cellphone", { phone: PhoneNum, captcha: Captcha }, function (data) {
                            if (data.code == 200) {
                                NeteaseCloudMusicCookie = data.cookie;
                                NeteaseCloudMusicCookie = encodeURIComponent(NeteaseCloudMusicCookie);
                                TopMsg("登录成功", '', false);
                                $("#NeteaseCloudMusicLoginButton").text("已登录");
                                console.log(NeteaseCloudMusicCookie)
                            } else {
                                TopMsg("登录失败", '请重试', true)
                            }
                        }).fail(function () {//错误处理
                            TopMsg("网络异常", '', true)
                        })
                    } else {
                        TopMsg("取消登录", '', true)
                    }
                } else {
                    TopMsg("验证码获取失败", '请重试', true)
                }
            }).fail(function () {//错误处理
            TopMsg("网络异常", '', true)
            })
        } else {
            TopMsg("取消登录", '', true)
        }
    })
})
//检查登录
function CheckLogin() {
    $.getJSON(ColudMusicAPI + "/login/status", { cookie: NeteaseCloudMusicCookie }, function (data) {
        if (data.data.account != null) {
            return true //登录状态正常
        } else {
            NeteaseCloudMusicCookie = ""
            $("#NeteaseCloudMusicLoginButton").text("登录过期");
            return false //登录状态异常，清除cookie
        }
    }).fail(function() {
        TopMsg("网络异常", '', true)
    })
}
//频谱开关
var SpectrumSwich = true;
$(document).ready(function () {
    $("#SpectrumSwichDiv").click(function () {
        SpectrumSwich = $("#SpectrumSwich").is(":checked");
        //console.log(SpectrumSwich);
        if (SpectrumSwich) {
            $(".visualization").animate({ height: 'show' }, 500);
            $(".lyric").animate({ height: 'hide' }, 500);
        } else {
            $(".lyric").animate({ height: 'show' }, 500);
            $(".visualization").animate({ height: 'hide' }, 500);
        }
    })
})
//频谱歌词切换函数。用于调试和弹幕控制
function SpectrumSwichChange() {
    if (SpectrumSwich) {
       $(".lyric").animate({ height: 'show' }, 500);
        $(".visualization").animate({ height: 'hide' }, 500);
        SpectrumSwich = false;
    } else {
        $(".visualization").animate({ height: 'show' }, 500);
        $(".lyric").animate({ height: 'hide' }, 500);
        SpectrumSwich = true;
    }
}
//mini模式
var MiniSwich = false;
$(document).ready(function () {
    $("#MiniSwichDiv").click(function () {
        MiniSwich = $("#MiniSwich").is(":checked");
        //console.log(MiniSwich);
        MiniSwichChange();
    })
})

function MiniSwichChange() {
    if (MiniSwich) {
        $(".rightBottom").animate({ width: 'hide' }, 500);
        $(".squareMenu").css({ borderRadius: 'calc(38.2vw / 1.382 / 10) calc(38.2vw / 1.382 / 10) calc(38.2vw / 1.382 / 10) calc(38.2vw / 1.382 / 10) '})
        $(".squareMenuInside").css({ borderRadius: 'calc(38.2vw / 1.382 / 10) calc(38.2vw / 1.382 / 10) calc(38.2vw / 1.382 / 10) calc(38.2vw / 1.382 / 10) ' })
} else {
        $(".rightBottom").animate({ width: 'show' }, 500);
        $(".squareMenu").css({ borderRadius: 'calc(38.2vw / 1.382 / 10) 0px 0px calc(38.2vw / 1.382 / 10)' })
        $(".squareMenuInside").css({ borderRadius: 'calc(38.2vw / 1.382 / 10) 0px 0px calc(38.2vw / 1.382 / 10)' })

        //    border-radius: calc(38.2vw / 1.382 / 10) 0px 0px calc(38.2vw / 1.382 / 10);

    }
}
//歌单指定
var SongListID = "8882371483";
$(document).ready(function () {
    $("#SongOrderButton").click(function () {
        SongListID = ($("#SongOrderInput").val());
        //console.log(SongListID);
        if (SongListID == "") {
            $("#SongOrderInput").val("");
            $("#SongOrderInput").attr("placeholder", "请输入歌单ID");
        } else {
            getSongList(SongListID);
        }
    })
})
//音量调节
function VolumeUp() {
    if (document.getElementById("Music").volume <= 0.95) {
        document.getElementById("Music").volume += 0.05;
    } else {
        document.getElementById("Music").volume = 1;
    }
}
function VolumeDown(){
    if (document.getElementById("Music").volume >= 0.05) {
        document.getElementById("Music").volume -= 0.05;
    } else {
        document.getElementById("Music").volume = 0;
    }
}

