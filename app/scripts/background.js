// If you make changes here, you have to reload the extension (in settings) for them to take effect

// Any function in this file can be referenced elsewhere by using chrome.extension.getBackgroundPage().myFunction()
// For example, you can reference the login function as chrome.extension.getBackgroundPage().login()

var config = {};
var token = null;
var expiresSeconds= 0;
var logger = console;

function init(cfg, log) {
  config = cfg;
  logger = log;
}

function getLastToken() {
  return token;
}

function getExpiresSeconds() {
  return expiresSeconds;
}

function login(config, callback) {
  //var redirectURL = encodeURIComponent(chrome.identity.getRedirectURL("oauth2"));
  //var authUrl = config.implicitGrantUrl
  //    + '?client_id=' + config.clientId
  //    + '&scope=' + config.scopes
  //    + '&redirect_uri=' + redirectURL + '&response_type=token';
  
  //var authUrl = 'https://accounts.google.com/o/oauth2/v2/auth';   //var authUrl = 'https://accounts.google.com/o/oauth2/auth';
  //var redirectURL = chrome.identity.getRedirectURL('oauth2');
  //var auth_params = {
  //  client_id: config.clientId,
  //  redirect_uri: redirectURL,
  //  response_type: 'token',
  //  scope: 'profile'
  //};
  //paramString = Object.keys(auth_params)
  //  .map(function(k) {
  //    return k + "=" + auth_params[k];
  //  })
  //  .join("&");
  //authUrl += "?" + paramString;
  //var url = new URLSearchParams(Object.entries(auth_params));
  //authUrl += "?" + url;

  var authUrl = 'https://www.moodle.com.tw/local/oauth/login.php';
  var redirectURL = chrome.identity.getRedirectURL('oauth2');
  var auth_params = {
    client_id: config.clientId,
    redirect_uri: redirectURL,
    response_type: 'code',
    grant_type: 'authorization_code',
    scope: 'user_info'
  };
  var url = new URLSearchParams(Object.entries(auth_params));
  authUrl += "?" + url;

  logger.debug('launchWebAuthFlow: ', authUrl);

  chrome.identity.launchWebAuthFlow({'url': authUrl, 'interactive': true}, function (redirectUrl) {
    //if (chrome.runtime.lastError) {
    //  return callback(new Error(chrome.runtime.lastError));
    //}
    //debugger;
    if (redirectUrl) {
      logger.debug('launchWebAuthFlow login successful: ', redirectUrl);
      var parsed = parse(redirectUrl.substr(chrome.identity.getRedirectURL("oauth2").length + 1));
      chrome.storage.sync.set({ code: parsed.code });
      //var parsed = parse(redirectUrl.substr(chrome.identity.getRedirectURL("oauth2").length + 1));
      //token = parsed.access_token;
      //logger.debug('Background login complete');
      //return callback(redirectUrl); // call the original callback now that we've intercepted what we needed
      return handleProviderCodeResponse(config, callback);
    } else {
      logger.debug("launchWebAuthFlow login failed. Is your redirect URL (" + chrome.identity.getRedirectURL("oauth2") + ") configured with your OAuth2 provider?");
      return (null);
    }
  });
}

function handleProviderCodeResponse(config, callback){
  chrome.storage.sync.get(['code'], (result) => {
    if (result.code) {
      // Make a request to revoke token in the server
      var tokenUrl = config.tokenInfoUrl; //'https://www.moodle.com.tw/local/oauth/token.php';
      var redirectURL = chrome.identity.getRedirectURL('oauth2');
      var token_params = {
        client_id: 'moodlecam1',
        client_secret: 'ebefdd3dabe0b7a6563471cf0ccfb56932b967247391fa11',
        'grant_type': 'authorization_code',
        'response_type': 'code',
        'redirect_uri': redirectURL,
        'User-Agent': 'GH WHATEVER',
        'code': result.code
      };
      var xhr = new XMLHttpRequest();
      xhr.open('POST', tokenUrl, true);
      xhr.onreadystatechange = function() {
        if (xhr.readyState == 4) {
          // WARNING! Might be injecting a malicious script!
          reponseObj = JSON.parse(xhr.responseText); // {"access_token":"290a1233174a7e478cb88c0811295fa761410620","expires_in":3600,"token_type":"Bearer","scope":"user_info","refresh_token":"6f352f6a3d7deb75f198a8503c780916ced0baa3"}
          if(reponseObj){
            chrome.storage.sync.set(reponseObj);
            token = reponseObj.access_token;
            expiresSeconds = reponseObj.expires_in;
            logger.debug('Background login complete');
            return callback(xhr.responseText);
          } else {
            logger.debug("launchWebAuthFlow get response token failed. ?", manifest);
            return (null);
          }
        }
      }
      var encodedData = new URLSearchParams(Object.entries(token_params));
      xhr.send(encodedData);
    }
  });
}

function logout(config, callback) {
  var logoutUrl = config.logoutUrl;
debugger;
  chrome.identity.launchWebAuthFlow({'url': logoutUrl, 'interactive': false}, function (redirectUrl) {
    logger.debug('launchWebAuthFlow logout complete');
    return callback(redirectUrl)
  });
}

function parse(str) {
  if (typeof str !== 'string') {
    return {};
  }
  str = str.trim().replace(/^(\?|#|&)/, '');
  if (!str) {
    return {};
  }
  return str.split('&').reduce(function (ret, param) {
    var parts = param.replace(/\+/g, ' ').split('=');
    // Firefox (pre 40) decodes `%3D` to `=`
    // https://github.com/sindresorhus/query-string/pull/37
    var key = parts.shift();
    var val = parts.length > 0 ? parts.join('=') : undefined;
    key = decodeURIComponent(key);
    // missing `=` should be `null`:
    // http://w3.org/TR/2012/WD-url-20120524/#collect-url-parameters
    val = val === undefined ? null : decodeURIComponent(val);
    if (!ret.hasOwnProperty(key)) {
      ret[key] = val;
    }
    else if (Array.isArray(ret[key])) {
      ret[key].push(val);
    }
    else {
      ret[key] = [ret[key], val];
    }
    return ret;
  }, {});
}

