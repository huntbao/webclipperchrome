//@huntbao @mknote
//All right reserved
(function(){
	$.extend(window.maikuClipper, {
		getPageReiveDouban: function(){
			var port = chrome.extension.connect({name:'review.douban'}),
			title = document.querySelector('span[property="v:summary"]'),
			reviewDate = document.querySelector('span[property="v:dtreviewed"]'),
			reviewDescription = document.querySelector('span[property="v:description"]'),
			reviewer = document.querySelector('span[property="v:reviewer"]'),
			itemReviewed = document.querySelector('span[property="v:itemreviewed"]');
			port.postMessage({
				title: '《' + itemReviewed.textContent + '》 的评论：' + title.textContent,
				sourceurl: location.href,
				content: reviewDate.textContent 
						 + '&nbsp;&nbsp;&nbsp;&nbsp;来自：' 
						 + reviewer.parentNode.outerHTML 
						 + '<br /><br /><p>' + reviewDescription.innerHTML + '</p>'
			});
		}
	});
})();
//douban's html structrue is very good for analysis 