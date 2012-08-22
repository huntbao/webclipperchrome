//@huntbao @mknote
//All right reserved
(function(){
    $.extend(window.maikuClipper, {
		getLinkInfoByUrlWeibo: function(url){
			var self = this,
			a = self.getLinkByUrl(url, 'a.date'),
			port = chrome.extension.connect({name:'link.weibo'});
			if(a){
				//date url, ok
				var contentContainer = $(a).parent().parent(),
				sendDataObj,
				contentEl;
				if(contentContainer.is('.content')){
					contentEl = contentContainer.find('p[node-type="feed_list_content"]');
					sendDataObj = self.getItemByNode(contentEl);
					//maybe has forward weibo, add it
					var comment = contentContainer.find('.comment');
					if(comment.length > 0 && comment.children().length > 1){
						//include forward data
						var commentData = self.getItemByNode(comment.find('dt[node-type="feed_list_forwardContent"]'));
						sendDataObj.content += '<br /><br /><em style="font-weight:bold;">【转发的微博】：</em><br /><br />' + commentData.content;
						sendDataObj.picurl = commentData.picurl;
					}
				}else{
					contentEl = contentContainer.find('dt[node-type="feed_list_forwardContent"]');
					sendDataObj = self.getItemByNode(contentEl);
				}
				port.postMessage({
					title: contentEl.text().trim(),
					sourceurl: url,
					content: sendDataObj.content,
					picurl: sendDataObj.picurl
				});
			}else{
				port.postMessage({
					error: true
				});
			}
		},
		getItemByNode: function(node){
			var pic = node.parent().find('img.bigcursor'),
			picurl;
			var cloneNode = node.clone().hide().insertBefore(node);
			cloneNode.find('*').each(function(idx, el){
				var tagName = el.tagName.toLowerCase();
				if(tagName == 'a'){
					el.href = el.href;
					$(el).css({
						color: $(el).css('color')
					});
				}else if(tagName == 'img'){
					$(el).css({
						background: $(el).css('background'),
						width: $(el).css('width') == '0px' ?  el.width : $(el).css('width'),
						height: $(el).css('height') == '0px' ?  el.height : $(el).css('height'),
						'vertical-align': $(el).css('vertical-align')
					});
				}else if(tagName == 'em'){
					$(el).css({
						'font-style': $(el).css('font-style')
					});
				}
				el.removeAttribute('class');
				el.removeAttribute('id');
			});
			if(pic.length > 0){
				picurl = pic[0].src.replace(/thumbnail/, 'large');
			}
			cloneNode.remove();
			return{
				content: cloneNode.html(),
				picurl: picurl
			}
		}
	});
})();