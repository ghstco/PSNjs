// load PSNRequest object (we will extend it with our helper functions)
var PSNRequest = require("./psn_request");

// which fields to request when getting a profile
var profileFields = "@default,relation,requestMessageFlag,presence,@personalDetail,trophySummary";
var friendFields = "@default,relation,onlineId,avatarUrl,plus,@personalDetail,trophySummary";
var messageFields = "@default,messageGroupId,messageGroupDetail,totalUnseenMessages,totalMessages,latestMessage";
var notificationFields = "@default,message,actionUrl";
var trophyFields = "@default,trophyRare,trophyEarnedRate";

/** Get a PSN user's profile
 * @param username		PSN username to request
 * @param callback		Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getProfile = function(username, callback)
{
	this.Get(
		this.ReplacePSNUsername("https://{{region}}-prof.np.community.playstation.net/userProfile/v1/users/{{id}}/profile", username),
		{
			fields: profileFields
		},
		callback
	);
};

/** Get current user's message groups
 * @param callback		Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getMessageGroups = function(callback)
{
	this.Get(
		"https://{{region}}-gmsg.np.community.playstation.net/groupMessaging/v1/users/{{psn}}/messageGroups",
		{
			fields: messageFields
		},
		callback
	);
};

/** Get data from a specific message. All this data can be found in getMessageGroups
 * @param messageGroupId 	Group ID requested message belongs to
 * @param messageUid 		Message ID to fetch
 * @param messageKind		Kind of message (as int)
 * @param callback			Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getMessageContent = function(messageGroupId, messageUid, messageKind, callback)
{
	var contentKey = false;

	// convert kind ID to contentKey string
	messageKind = parseInt(messageKind);
	if (messageKind == 1) contentKey = "message"; // text (no attachment)
	else if (messageKind == 3) contentKey = "image-data-0"; // photo/image
	else if (messageKind == 1011) contentKey = "voice-data-0"; // voice data
	else if (messageKind == 8) contentKey = "store-url-0"; // PSN store link

	if (!contentKey)
	{
		// check js/people/groupmessage.js in PSN app to find contentKey types (and their kind IDs)
		if (callback) callback("Error: Unknown PSN message kind: " + messageKind);
		return;
	}

	this.Get(
		"https://{{region}}-gmsg.np.community.playstation.net/groupMessaging/v1/messageGroups/{{messageGroupId}}/messages/{{messageUid}}".
			replace("{{messageGroupId}}", this.CleanPSNList(messageGroupId)).
			replace("{{messageUid}}", parseInt(messageUid)),
		{
			contentKey: contentKey
		},
		callback
	);
};

// list valid filters for activity feeds
PSNRequest.prototype.activityTypes = [
	"PURCHASED",
	"RATED",
	"PLAYED_WITH",
	"VIDEO_UPLOAD",
	"SCREENSHOT_UPLOAD",
	"PLAYED_GAME",
	"LAUNCHED_GAME_FIRST_TIME",
	"WATCHED_VIDEO",
	"TROPHY",
	"BROADCASTING",
	"LIKED",
	"PROFILE_ABOUT_ME",
	"PROFILE_PIC",
	"FRIENDED",
	"CONTENT_SHARE",
	"STORE_PROMO",
	"IN_GAME_POST"
];

/** Get the signed-in user's activity feed
 * @param feed		type of feed, either "feed" or "news" (optional, defaults to "news")
 * @param filters	array of strings to filter by (optional, defaults to no filters)
 *					Allowed: PURCHASED, RATED, VIDEO_UPLOAD, SCREENSHOT_UPLOAD, PLAYED_GAME, STORE_PROMO, WATCHED_VIDEO, TROPHY, BROADCASTING, LIKED, PROFILE_PIC, FRIENDED and CONTENT_SHARE
 *					Use an empty array (or leave out argument) for all types
 * @param page 		Page of feed to load (default: 0)
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getLatestActivity = function(feed, filters, page, callback)
{
	// handle defaults for missing feed or filters arguments
	if (typeof feed == "function")
	{
		callback = feed;
		feed = "news";
		filters = [];
		page = 0;
	}
	else if (typeof filters == "function")
	{
		callback = filters;
		filters = [];
		page = 0;
	}
	else if (typeof page == "function")
	{
		callback = page;
		page = 0;
	}

	// check filters are valid
	for(var i=0; i<filters.length; i++)
	{
		// remove filter if not in our valid list
		if (this.activityTypes.indexOf(filters[i]) == -1)
		{
			filters.splice(i, 1);
			i--;
		}
	}

	this.Get(
		"https://activity.api.np.km.playstation.net/activity/api/v1/users/{{psn}}/" + (feed == "feed" ? "feed" : "news") + "/" + parseInt(page),
		{
			filters: filters
		},
		callback
	);
};

/** Like an activity from the activity feed
 * @param storyId	The ID of the activity we want to like
 * @param dislike	(optional) set to true to dislike instead of like
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.likeActivity = function(storyId, dislike, callback)
{
	// support passing dislike manually into the function
	if (typeof dislike == "function")
	{
		callback = dislike;
		dislike = false;
	}

	this.Get(
		"https://activity.api.np.km.playstation.net/activity/api/v1/users/{{psn}}/set/" + (dislike ? "dis" : "") + "like/story/{{storyId}}".
		// tidy up passed in story ID - contains 42 lower-case hexadecimal chars in format: {8}-{4}-{4}-{4}-{12}
		replace("{{storyId}}", storyId.replace(/[^a-z0-9\-]/g, "")),
		{},
		callback
	);
};

/** Dislike an activity from the activity feed
 * @param storyId	The ID of the activity we want to dislike
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.dislikeActivity = function(storyId, callback)
{
	// just call like with dislike set to true
	this.likeActivity(storyId, true, callback);
};

/** Get notifications of currently authenticated user
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getNotifications = function(callback)
{
	this.Get(
		"https://{{region}}-ntl.np.community.playstation.net/notificationList/v1/users/{{psn}}/notifications",
		{
			fields: notificationFields,
			npLanguage: "{{lang}}"
		},
		callback
	);
};

/** Add a friend to PSN (must have received a friend request from the user)
 * @param username	Username to add
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.addFriend = function(username, callback)
{
	this.Put(
		this.ReplacePSNUsername("https://{{region}}-prof.np.community.playstation.net/userProfile/v1/users/{{psn}}/friendList/{{id}}", username),
		{},
		callback
	);
};

/** Remove a friend from PSN
 * @param username	Username to remove
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.removeFriend = function(username, callback)
{
	this.Delete(
		this.ReplacePSNUsername("https://{{region}}-prof.np.community.playstation.net/userProfile/v1/users/{{psn}}/friendList/{{id}}", username),
		{},
		callback
	);
};

/** Send a friend request to a user
 * @param username	Username to add
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.sendFriendRequest = function(username, message, callback)
{
	this.Post(
		this.ReplacePSNUsername("https://{{region}}-prof.np.community.playstation.net/userProfile/v1/users/{{psn}}/friendList/{{id}}", username),
		{
			requestMessage: message
		},
		callback
	);
};

/** Get the user's friend list
 * @param offset		(optional) Index to start friend list
 * @param limit			(optional) Maximum limit of friends to fetch
 * @param friendType 	(optional) Type of friends to filter by (accepts friend, requesting or requested)
 * @param callback		Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getFriends = function(offset, limit, friendType, callback)
{
	// most variables are optional
	if (typeof offset == "function")
	{
		callback = offset;
		offset = 0;
		limit = 32;
		friendType = "friend";
	}
	else if (typeof limit == "function")
	{
		callback = limit;
		limit = 32;
		friendType = "friend";
	}
	else if (typeof friendType == "function")
	{
		callback = friendType;
		friendType = "friend";
	}

	// fallback on default "friend" type if invalid option is supplied
	if (friendType != "requesting" && friendType != "requested")
	{
		friendType = "friend";
	}

	this.Get(
		"https://{{region}}-prof.np.community.playstation.net/userProfile/v1/users/{{psn}}/friendList",
		{
			fields: friendFields,
			sort: "onlineId", // sort by onlineID
			avatarSize: "l", // large avatar images
			limit: limit,
			offset: offset,
			friendStatus: friendType
		},
		callback
	);
};

/** Generate a friend URL you can give to people to add you as a friend.
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.generateFriendURL = function(callback)
{
	this.Post(
		"https://friendme.sonyentertainmentnetwork.com/friendme/api/v1/c2s/users/me/friendrequest",
		{
			type: "ONE"
		},
		callback
	);
};

/** Fetch trophy data for the logged in user (and optionally compare to another user)
 * @param offset	(optional) Starting index of trophy data
 * @param limit		(optional) Maximum number of titles to fetch
 * @param username	(optional) PSN ID to compare trophies with
 * @param callback	Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getUserTrophies = function(offset, limit, username, callback)
{
	// sort out optional variables
	if (typeof offset == "function")
	{
		callback = offset;
		offset = 0;
		limit = 32;
		username = false;
	}
	else if (typeof limit == "function")
	{
		callback = limit;
		limit = 32;
		username = false;
	}
	else if (typeof username == "function")
	{
		callback = username;
		username = false;
	}

	var options = {
		fields: "@default",
		npLanguage: "{{lang}}",
		iconSize: "m",
		platform: "PS3,PSVITA,PS4",
		offset: offset,
		limit: limit
	};

	// optionally supply compared user
	if (username)
	{
		// make sure username is valid
		options.comparedUser = this.CleanPSN(username);
	}

	this.Get(
		"https://{{region}}-tpy.np.community.playstation.net/trophy/v1/trophyTitles",
		options,
		callback
	);
};

/** Get list of trophy groups for a title (eg. base game + DLC packs)
 * @param npCommunicationId		Title ID
 * @param Username 				(optional) Username to compare trophies to
 * @param callback				Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getTrophyGroups = function(npCommunicationId, username, callback)
{
	// compare username is optional
	if (typeof username == "function")
	{
		callback = username;
		username = false;
	}

	var options = {
		npLanguage: "{{lang}}"
	};

	// compare to a user if supplied
	if (username)
	{
		// make sure username is valid
		options.comparedUser = this.CleanPSN(username);
	}

	this.Get(
		"https://{{region}}-tpy.np.community.playstation.net/trophy/v1/trophyTitles/{{npCommunicationId}}/trophyGroups/"
		.replace("{{npCommunicationId}}", this.CleanNPCommID(npCommunicationId)),
		options,
		callback
	);
};

/** Get a title's trophies (supplying a trophy group), optionally comparing to another user.
 * @param npCommunicationId 	Title ID
 * @param trophyGroupId			Trophy Group ID (from getTrophyGroups)
 * @param Username 				(optional) Username to compare trophies to
 * @param callback				Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getTrophies = function(npCommunicationId, trophyGroupId, username, callback)
{
	// compare username is optional
	if (typeof username == "function")
	{
		callback = username;
		username = false;
	}

	var options = {
		fields: trophyFields,
		npLanguage: "{{lang}}"
	};

	// compare to a user if supplied
	if (username)
	{
		// make sure username is valid
		options.comparedUser = this.CleanPSN(username);
	}

	this.Get(
		"https://{{region}}-tpy.np.community.playstation.net/trophy/v1/trophyTitles/{{npCommunicationId}}/trophyGroups/{{groupId}}/trophies"
		.replace("{{npCommunicationId}}", this.CleanNPCommID(npCommunicationId))
		.replace("{{groupId}}", this.CleanNPCommID(trophyGroupId)),
		options,
		callback
	);
};

/** Get data on a specific trophy in a title with supplied trophyId. Optionally compare to a username.
 * @param npCommunicationId 	Title ID
 * @param trophyGroupId			Trophy Group ID (from getTrophyGroups)
 * @param trophyId 				Trophy ID
 * @param Username 				(optional) Username to compare trophies to
 * @param callback				Callback function with error (false if no error) and returned data object
 */
PSNRequest.prototype.getTrophy = function(npCommunicationId, trophyGroupId, trophyId, username, callback)
{
	// compare username is optional
	if (typeof username == "function")
	{
		callback = username;
		username = false;
	}

	var options = {
		fields: trophyFields,
		npLanguage: "{{lang}}"
	};

	// compare to a user if supplied
	if (username)
	{
		// make sure username is valid
		options.comparedUser = this.CleanPSN(username);
	}

	this.Get(
		"https://{{region}}-tpy.np.community.playstation.net/trophy/v1/trophyTitles/{{npCommunicationId}}/trophyGroups/{{groupId}}/trophies/{{trophyID}}"
		.replace("{{npCommunicationId}}", this.CleanNPCommID(npCommunicationId))
		.replace("{{groupId}}", this.CleanNPCommID(trophyGroupId))
		.replace("{{trophyID}}", parseInt(trophyId)),
		options,
		callback
	);
};

// return our new psn request object with our new helper functions
module.exports = PSNRequest;