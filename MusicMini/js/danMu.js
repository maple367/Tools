//弹幕轮询
setInterval(function () {
    if (((DanmuCtrlSwich == true) || (DanmuOrderSwich == true)) && (RoomID != "0")) {//判断开关状态，全关则停止轮询

        fetch(BiliDanMuAPI + "?roomid=" + RoomID, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            referrerPolicy: 'origin'
        })
        .then(response => response.json())
        .then(data => {
            if (data.error == 1) {//错误请求处理
                TopMsg("房间错误", RoomID, true)
            } else {
                var adminMsg = data.data.admin;//管理信息
                var roomMsg = data.data.room;//房间信息
                //管理功能:强制点歌，播放歌单....
                if (DanmuCtrlSwich == true) {
                    for (i in adminMsg) {
                        if (((Date.parse(new Date()) / 1000) - 20) <= timeLine(adminMsg[i].timeline)) {
                            //切歌 歌单 点歌
                            if (adminMsg[i].text.slice(0, 4) == "#歌单 ") {
                                //设置歌单
                                getSongList(Number(adminMsg[i].text.slice(4)));
                                TopMsg("导入歌单", adminMsg[i].text.slice(4), false);
                            } else if (adminMsg[i].text.slice(0, 4) == "#播放 ") {
                                //强制播放歌曲
                                SongSearch(adminMsg[i].text.slice(4))
                            } else if (adminMsg[i].text.slice(0, 6) == "#ID播放 ") {
                                //强制按ID播放歌曲
                                SongPlay_forceId(adminMsg[i].text.slice(6))
                            } else if (adminMsg[i].text.slice(0, 4) == "#提示 ") {
                                //发送顶部提示
                                TopMsg("提示", adminMsg[i].text.slice(4), true);
                            } else if (adminMsg[i].text.slice(0, 3) == "#歌词") {
                                //切换歌词
                                TopMsg("歌词切换", "", false);
                                SpectrumSwichChange();
                            } else if (adminMsg[i].text.slice(0, 4) == "#点歌 ") {
                                //点歌函数
                                GetOrederList(adminMsg[i].text.slice(4))
                            } else if (adminMsg[i].text.slice(0, 3) == "#切歌") {
                                //切歌
                                TopMsg("已切歌", "房管", false);
                                NextMusic(true, true);
                            }
                        }
                    }
                }
                //游客功能:点歌，切歌
                if (DanmuOrderSwich == true) {
                    for (i in roomMsg) {
                        if (((Date.parse(new Date()) / 1000) - 20) <= timeLine(roomMsg[i].timeline)) {
                            if (Number(roomMsg[i].isadmin) != 1) {
                                if (roomMsg[i].text.slice(0, 4) == "#点歌 ") {
                                    //相关函数
                                    if (order_CD_list.includes(roomMsg[i].uid)) {
                                        //点歌CD
                                        TopMsg("点歌失败", "冷却中", true);
                                    } else if (order_list.length >= orderListLength) {
                                        //歌单已满
                                        TopMsg("点歌失败", "歌单已满", true);
                                    } else {
                                        //观众点歌
                                        order_CD_list.push(roomMsg[i].uid);
                                        //点歌函数
                                        GetOrederList(roomMsg[i].text.slice(4))
                                    }
                                }
                                else if (roomMsg[i].text.slice(0, 3) == "#切歌") {
                                    //切歌
                                    if (next_CD_list.includes(roomMsg[i].uid)) {
                                        //切歌CD
                                        TopMsg("切歌失败", "冷却中", true);
                                    } else {
                                        //观众切歌
                                        next_CD_list.push(roomMsg[i].uid);
                                        TopMsg("已切歌", "观众", false);
                                        NextMusic(true, true);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        })
        .catch(error => {
            TopMsg("弹幕获取失败", '', true)
            console.log("[网络错误]弹幕服务器无响应或者返回了错误的数据")
        });
    }
}, 20000);


function timeLine(timeLine) {
    var date = new Date(timeLine);
    return (date.getTime() / 1000)
}

// 初始化歌单
// getSongList(SongListID);