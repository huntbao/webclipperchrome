//@huntbao @mknote
//All right reserved
(function(){
    'use strict';
	var contextMenuForSites = {
		init: function(){
			var self = this;
            chrome.extension.onConnect.addListener(function(port){
                switch(port.name){
					case 'link.weibo':
						self.weiboLinkHandler(port);
						break;
					case 'review.douban':
						self.doubanReviewHandler(port);
						break;
                    default:
						break;
                }
            });
		},
		weiboLinkHandler: function(port){
			var that = maikuNote;
			port.onMessage.addListener(function(msg){
                if(msg.error){
					that.notify('选择微博的时间链接才能剪辑该条微博。');
				}else{
					var content = msg.content,
                    tag = '新浪微博';
                    if(msg.picurl){
                        if(maikuNoteOptions.serializeImg){
                            that.saveImgs({
                                imgs: [msg.picurl],
                                title: msg.title,
                                imgTitles: [''],
                                tags: tag,
                                sourceurl: msg.sourceurl
                            }, function(data, serializeSucceedImgIndexByOrder, noteId){
                                content += '<br /><img src="' + data[0].ExternalUrl + '">';
                                that.saveNote(msg.title, msg.sourceurl, content, tag, '', noteId);
                            }, function(){
                                that.saveNote(msg.title, msg.sourceurl, content, tag);
                            });
                        }else{
                            content += '<br /><img src="' + msg.picurl + '">';
                            that.saveNote(msg.title, msg.sourceurl, content, tag);
                        }
                    }else{
                        that.saveNote(msg.title, msg.sourceurl, content, tag);
                    }
				}
            });
		},
		weibo: function(){
			var self = this;
			window.maikuNote.initContextMenus(function(){
				chrome.contextMenus.create({
					contexts: ['link'],
					title: chrome.i18n.getMessage('clipLinkContextMenuWeibo'),
					onclick: function(info, tab){
						chrome.tabs.executeScript(null, {code: "maikuClipper.getLinkInfoByUrlWeibo('" + info.linkUrl + "');"});
					}
				});
			});
		},
		doubanReviewHandler: function(port){
			var that = maikuNote;
			port.onMessage.addListener(function(msg){
				that.saveNote(msg.title, msg.sourceurl, msg.content, '豆瓣评论');
            });
		},
		douban: function(){
			var self = this;
			window.maikuNote.initContextMenus(function(){
				chrome.contextMenus.create({
					contexts: ['page'],
					title: chrome.i18n.getMessage('clipReviewContextMenuDouban'),
					onclick: function(info, tab){
						chrome.tabs.executeScript(null, {code: "maikuClipper.getPageReiveDouban();"});
					}
				});
			});
		}
	}
	window.maikuNoteUtil = {
		createParticularContextMenu: function(host){
			console.log('recreate context menu, current host is: ' + host)
			switch(host){
				case 'weibo.com':
				case 'www.weibo.com':
				case 's.weibo.com':
				case 'e.weibo.com':
					contextMenuForSites.weibo();
					break;
				case 'movie.douban.com':
				case 'book.douban.com':
				case 'music.douban.com':
					contextMenuForSites.douban();
					break;
				default:
					window.maikuNote.initContextMenus();
					break;
			}
		}
	}
	contextMenuForSites.init();
})();

