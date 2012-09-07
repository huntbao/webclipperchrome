//@huntbao @mknote
//All right reserved
(function(){
    $.extend(window.maikuClipper, {
		getLinkInfoByUrlWeibo: function(url){
			var self = this,
			a = self.getLinkByUrl(url, 'a[node-type="feed_list_item_date"]'),
			port = chrome.extension.connect({name:'link.weibo'});
			if(a){
				//date url, ok
				var contentContainer = $(a).parent().parent(),
				sendDataObj,
                noteContent = '',
                forwardStr = '<br /><br /><em style="font-weight:bold;">【转发的微博】</em><br /><br />',
				contentEl;
				if(contentContainer.is('.content')){
                    contentEl = contentContainer.find('p[node-type="feed_list_content"]');
                    noteContent += contentEl.text().trim();
                    //maybe has forward weibo, add it
                    var comment = contentContainer.find('.comment');
                    if(comment.length > 0 && comment.children().length > 1){
                        //include forward data
                        var commentNode = comment.find('dt[node-type="feed_list_forwardContent"]');
                        noteContent += forwardStr;
                        noteContent += commentNode.text().trim() + '<br /><br />';
                    }
                    var img = contentEl.parent().find('img.bigcursor'),
                    title = contentEl.text().trim();
                    self.saveWeiBoNote(port, img, title, url, noteContent);
                }else if(contentContainer.is('.WB_func')){
                    contentContainer = contentContainer.parent();
                    //new version weibo - 120905
                    var infos = contentContainer.find('.WB_info'),
                    texts = contentContainer.find('.WB_text'),
                    //微博首页
                    img = contentContainer.find('img[node-type = "feed_list_media_bgimg"]');
                    if(img.length == 0){
                        //点击时间链接后的该条微博的详情页面
                        img = contentContainer.find('img[action-type = "feed_list_media_bigimg"]');
                    }
                    var title = texts.eq(0).text().trim();
                    
                    if(texts.length == 1){
                        if(infos.length == 1){
                            noteContent += infos.text().trim() + '：';
                            noteContent += title;
                            title = infos.text().trim() + '：' + title;
                        }else if(infos.length == 0){
                            noteContent += title;
                        }
                    }else if(texts.length == 2){
                        //noteContent += infos.text().trim() + '：';
                        if(infos.length == 1){
                            noteContent += title + '：';
                            noteContent += forwardStr;
                            noteContent += infos.text().trim() + '：';
                            noteContent += texts.eq(1).text().trim() + '：';
                        }else if(infos.length == 2){
                            noteContent += infos.eq(0).text().trim() + '：';
                            noteContent += title + '：';
                            noteContent += forwardStr;
                            noteContent += infos.eq(1).text().trim() + '：';
                            noteContent += texts.eq(1).text().trim() + '：';
                            title = infos.eq(0).text().trim() + '：' + title;
                        }
                    }
                    noteContent += '<br /><br />';
                    self.saveWeiBoNote(port, img, title, url, noteContent);
                }
			}else{
				port.postMessage({
					error: true
				});
			}
		},
        saveWeiBoNote: function(port, img, title, sourceurl, noteContent){
            var self = this,
            picurl;
            if(img.length > 0){
                picurl = img[0].src.replace(/thumbnail/, 'large').replace(/bmiddle/, 'large');
            }
            port.postMessage({
                title: title,
                sourceurl: sourceurl,
                content: noteContent,
                picurl: picurl
            });
        }
	});
})();