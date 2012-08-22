//@huntbao @mknote
//All right reserved
(function($){
	$(function(){
		var backgroundPage = chrome.extension.getBackgroundPage(),
		notificationData = backgroundPage.maikuNote.notificationData,
		title = $('#title').html(notificationData.title),
		content = $('#content').html(notificationData.content),
		changeContent = function(data){
			content.css('opacity', 1);//must set opacity to '1' before fadeOut called
            content.fadeOut(function(){
				$(this).html(data.content).fadeIn();
				checkCloseBtn();
			});
		},
		checkCloseBtn = function(){
			var closeBtn = $('#closebtn');
			if(closeBtn.length > 0){
				closeBtn.click(function(){
					setTimeout(function(){
						backgroundPage.maikuNote.notification.cancel();
					},0);
				});
			}
		}
		checkCloseBtn();
		chrome.extension.onMessage.addListener(function(request, sender){
			if(!sender || sender.id !== chrome.i18n.getMessage("@@extension_id")) return;
			if(request.name == 'sendnotification'){
				changeContent(request.data);
			}
		});
	});
})(jQuery);