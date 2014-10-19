(function(){"use strict";function e(){}function n(e,t){var n=e.length;while(n--){if(e[n].listener===t){return n}}return-1}function r(e){return function(){return this[e].apply(this,arguments)}}var t=e.prototype;t.getListeners=function(t){var n=this._getEvents();var r;var i;if(typeof t==="object"){r={};for(i in n){if(n.hasOwnProperty(i)&&t.test(i)){r[i]=n[i]}}}else{r=n[t]||(n[t]=[])}return r};t.flattenListeners=function(t){var n=[];var r;for(r=0;r<t.length;r+=1){n.push(t[r].listener)}return n};t.getListenersAsObject=function(t){var n=this.getListeners(t);var r;if(n instanceof Array){r={};r[t]=n}return r||n};t.addListener=function(t,r){var i=this.getListenersAsObject(t);var s=typeof r==="object";var o;for(o in i){if(i.hasOwnProperty(o)&&n(i[o],r)===-1){i[o].push(s?r:{listener:r,once:false})}}return this};t.on=r("addListener");t.addOnceListener=function(t,n){return this.addListener(t,{listener:n,once:true})};t.once=r("addOnceListener");t.defineEvent=function(t){this.getListeners(t);return this};t.defineEvents=function(t){for(var n=0;n<t.length;n+=1){this.defineEvent(t[n])}return this};t.removeListener=function(t,r){var i=this.getListenersAsObject(t);var s;var o;for(o in i){if(i.hasOwnProperty(o)){s=n(i[o],r);if(s!==-1){i[o].splice(s,1)}}}return this};t.off=r("removeListener");t.addListeners=function(t,n){return this.manipulateListeners(false,t,n)};t.removeListeners=function(t,n){return this.manipulateListeners(true,t,n)};t.manipulateListeners=function(t,n,r){var i;var s;var o=t?this.removeListener:this.addListener;var u=t?this.removeListeners:this.addListeners;if(typeof n==="object"&&!(n instanceof RegExp)){for(i in n){if(n.hasOwnProperty(i)&&(s=n[i])){if(typeof s==="function"){o.call(this,i,s)}else{u.call(this,i,s)}}}}else{i=r.length;while(i--){o.call(this,n,r[i])}}return this};t.removeEvent=function(t){var n=typeof t;var r=this._getEvents();var i;if(n==="string"){delete r[t]}else if(n==="object"){for(i in r){if(r.hasOwnProperty(i)&&t.test(i)){delete r[i]}}}else{delete this._events}return this};t.emitEvent=function(t,n){var r=this.getListenersAsObject(t);var i;var s;var o;var u;for(o in r){if(r.hasOwnProperty(o)){s=r[o].length;while(s--){i=r[o][s];if(i.once===true){this.removeListener(t,i.listener)}u=i.listener.apply(this,n||[]);if(u===this._getOnceReturnValue()){this.removeListener(t,i.listener)}}}}return this};t.trigger=r("emitEvent");t.emit=function(t){var n=Array.prototype.slice.call(arguments,1);return this.emitEvent(t,n)};t.setOnceReturnValue=function(t){this._onceReturnValue=t;return this};t._getOnceReturnValue=function(){if(this.hasOwnProperty("_onceReturnValue")){return this._onceReturnValue}else{return true}};t._getEvents=function(){return this._events||(this._events={})};if(typeof define==="function"&&define.amd){define(function(){return e})}else if(typeof module==="object"&&module.exports){module.exports=e}else{this.EventEmitter=e}}).call(this)