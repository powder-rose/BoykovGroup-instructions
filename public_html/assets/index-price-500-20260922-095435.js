(function(){const t=document.createElement("link").relList;if(t&&t.supports&&t.supports("modulepreload"))return;for(const o of document.querySelectorAll('link[rel="modulepreload"]'))r(o);new MutationObserver(o=>{for(const l of o)if(l.type==="childList")for(const i of l.addedNodes)i.tagName==="LINK"&&i.rel==="modulepreload"&&r(i)}).observe(document,{childList:!0,subtree:!0});function n(o){const l={};return o.integrity&&(l.integrity=o.integrity),o.referrerPolicy&&(l.referrerPolicy=o.referrerPolicy),o.crossOrigin==="use-credentials"?l.credentials="include":o.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function r(o){if(o.ep)return;o.ep=!0;const l=n(o);fetch(o.href,l)}})();function Qp(e){return e&&e.__esModule&&Object.prototype.hasOwnProperty.call(e,"default")?e.default:e}var kc={exports:{}},xl={},Ec={exports:{}},D={};/**
 * @license React
 * react.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Zr=Symbol.for("react.element"),qp=Symbol.for("react.portal"),Kp=Symbol.for("react.fragment"),Gp=Symbol.for("react.strict_mode"),Yp=Symbol.for("react.profiler"),Xp=Symbol.for("react.provider"),Jp=Symbol.for("react.context"),Zp=Symbol.for("react.forward_ref"),em=Symbol.for("react.suspense"),tm=Symbol.for("react.memo"),nm=Symbol.for("react.lazy"),qa=Symbol.iterator;function rm(e){return e===null||typeof e!="object"?null:(e=qa&&e[qa]||e["@@iterator"],typeof e=="function"?e:null)}var jc={isMounted:function(){return!1},enqueueForceUpdate:function(){},enqueueReplaceState:function(){},enqueueSetState:function(){}},Cc=Object.assign,Nc={};function er(e,t,n){this.props=e,this.context=t,this.refs=Nc,this.updater=n||jc}er.prototype.isReactComponent={};er.prototype.setState=function(e,t){if(typeof e!="object"&&typeof e!="function"&&e!=null)throw Error("setState(...): takes an object of state variables to update or a function which returns an object of state variables.");this.updater.enqueueSetState(this,e,t,"setState")};er.prototype.forceUpdate=function(e){this.updater.enqueueForceUpdate(this,e,"forceUpdate")};function Rc(){}Rc.prototype=er.prototype;function Ms(e,t,n){this.props=e,this.context=t,this.refs=Nc,this.updater=n||jc}var Os=Ms.prototype=new Rc;Os.constructor=Ms;Cc(Os,er.prototype);Os.isPureReactComponent=!0;var Ka=Array.isArray,Pc=Object.prototype.hasOwnProperty,zs={current:null},Lc={key:!0,ref:!0,__self:!0,__source:!0};function Ic(e,t,n){var r,o={},l=null,i=null;if(t!=null)for(r in t.ref!==void 0&&(i=t.ref),t.key!==void 0&&(l=""+t.key),t)Pc.call(t,r)&&!Lc.hasOwnProperty(r)&&(o[r]=t[r]);var a=arguments.length-2;if(a===1)o.children=n;else if(1<a){for(var u=Array(a),c=0;c<a;c++)u[c]=arguments[c+2];o.children=u}if(e&&e.defaultProps)for(r in a=e.defaultProps,a)o[r]===void 0&&(o[r]=a[r]);return{$$typeof:Zr,type:e,key:l,ref:i,props:o,_owner:zs.current}}function om(e,t){return{$$typeof:Zr,type:e.type,key:t,ref:e.ref,props:e.props,_owner:e._owner}}function As(e){return typeof e=="object"&&e!==null&&e.$$typeof===Zr}function lm(e){var t={"=":"=0",":":"=2"};return"$"+e.replace(/[=:]/g,function(n){return t[n]})}var Ga=/\/+/g;function si(e,t){return typeof e=="object"&&e!==null&&e.key!=null?lm(""+e.key):t.toString(36)}function Po(e,t,n,r,o){var l=typeof e;(l==="undefined"||l==="boolean")&&(e=null);var i=!1;if(e===null)i=!0;else switch(l){case"string":case"number":i=!0;break;case"object":switch(e.$$typeof){case Zr:case qp:i=!0}}if(i)return i=e,o=o(i),e=r===""?"."+si(i,0):r,Ka(o)?(n="",e!=null&&(n=e.replace(Ga,"$&/")+"/"),Po(o,t,n,"",function(c){return c})):o!=null&&(As(o)&&(o=om(o,n+(!o.key||i&&i.key===o.key?"":(""+o.key).replace(Ga,"$&/")+"/")+e)),t.push(o)),1;if(i=0,r=r===""?".":r+":",Ka(e))for(var a=0;a<e.length;a++){l=e[a];var u=r+si(l,a);i+=Po(l,t,n,u,o)}else if(u=rm(e),typeof u=="function")for(e=u.call(e),a=0;!(l=e.next()).done;)l=l.value,u=r+si(l,a++),i+=Po(l,t,n,u,o);else if(l==="object")throw t=String(e),Error("Objects are not valid as a React child (found: "+(t==="[object Object]"?"object with keys {"+Object.keys(e).join(", ")+"}":t)+"). If you meant to render a collection of children, use an array instead.");return i}function ao(e,t,n){if(e==null)return e;var r=[],o=0;return Po(e,r,"","",function(l){return t.call(n,l,o++)}),r}function im(e){if(e._status===-1){var t=e._result;t=t(),t.then(function(n){(e._status===0||e._status===-1)&&(e._status=1,e._result=n)},function(n){(e._status===0||e._status===-1)&&(e._status=2,e._result=n)}),e._status===-1&&(e._status=0,e._result=t)}if(e._status===1)return e._result.default;throw e._result}var Pe={current:null},Lo={transition:null},sm={ReactCurrentDispatcher:Pe,ReactCurrentBatchConfig:Lo,ReactCurrentOwner:zs};function $c(){throw Error("act(...) is not supported in production builds of React.")}D.Children={map:ao,forEach:function(e,t,n){ao(e,function(){t.apply(this,arguments)},n)},count:function(e){var t=0;return ao(e,function(){t++}),t},toArray:function(e){return ao(e,function(t){return t})||[]},only:function(e){if(!As(e))throw Error("React.Children.only expected to receive a single React element child.");return e}};D.Component=er;D.Fragment=Kp;D.Profiler=Yp;D.PureComponent=Ms;D.StrictMode=Gp;D.Suspense=em;D.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=sm;D.act=$c;D.cloneElement=function(e,t,n){if(e==null)throw Error("React.cloneElement(...): The argument must be a React element, but you passed "+e+".");var r=Cc({},e.props),o=e.key,l=e.ref,i=e._owner;if(t!=null){if(t.ref!==void 0&&(l=t.ref,i=zs.current),t.key!==void 0&&(o=""+t.key),e.type&&e.type.defaultProps)var a=e.type.defaultProps;for(u in t)Pc.call(t,u)&&!Lc.hasOwnProperty(u)&&(r[u]=t[u]===void 0&&a!==void 0?a[u]:t[u])}var u=arguments.length-2;if(u===1)r.children=n;else if(1<u){a=Array(u);for(var c=0;c<u;c++)a[c]=arguments[c+2];r.children=a}return{$$typeof:Zr,type:e.type,key:o,ref:l,props:r,_owner:i}};D.createContext=function(e){return e={$$typeof:Jp,_currentValue:e,_currentValue2:e,_threadCount:0,Provider:null,Consumer:null,_defaultValue:null,_globalName:null},e.Provider={$$typeof:Xp,_context:e},e.Consumer=e};D.createElement=Ic;D.createFactory=function(e){var t=Ic.bind(null,e);return t.type=e,t};D.createRef=function(){return{current:null}};D.forwardRef=function(e){return{$$typeof:Zp,render:e}};D.isValidElement=As;D.lazy=function(e){return{$$typeof:nm,_payload:{_status:-1,_result:e},_init:im}};D.memo=function(e,t){return{$$typeof:tm,type:e,compare:t===void 0?null:t}};D.startTransition=function(e){var t=Lo.transition;Lo.transition={};try{e()}finally{Lo.transition=t}};D.unstable_act=$c;D.useCallback=function(e,t){return Pe.current.useCallback(e,t)};D.useContext=function(e){return Pe.current.useContext(e)};D.useDebugValue=function(){};D.useDeferredValue=function(e){return Pe.current.useDeferredValue(e)};D.useEffect=function(e,t){return Pe.current.useEffect(e,t)};D.useId=function(){return Pe.current.useId()};D.useImperativeHandle=function(e,t,n){return Pe.current.useImperativeHandle(e,t,n)};D.useInsertionEffect=function(e,t){return Pe.current.useInsertionEffect(e,t)};D.useLayoutEffect=function(e,t){return Pe.current.useLayoutEffect(e,t)};D.useMemo=function(e,t){return Pe.current.useMemo(e,t)};D.useReducer=function(e,t,n){return Pe.current.useReducer(e,t,n)};D.useRef=function(e){return Pe.current.useRef(e)};D.useState=function(e){return Pe.current.useState(e)};D.useSyncExternalStore=function(e,t,n){return Pe.current.useSyncExternalStore(e,t,n)};D.useTransition=function(){return Pe.current.useTransition()};D.version="18.3.1";Ec.exports=D;var g=Ec.exports;const am=Qp(g);/**
 * @license React
 * react-jsx-runtime.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var um=g,cm=Symbol.for("react.element"),dm=Symbol.for("react.fragment"),fm=Object.prototype.hasOwnProperty,pm=um.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner,mm={key:!0,ref:!0,__self:!0,__source:!0};function Tc(e,t,n){var r,o={},l=null,i=null;n!==void 0&&(l=""+n),t.key!==void 0&&(l=""+t.key),t.ref!==void 0&&(i=t.ref);for(r in t)fm.call(t,r)&&!mm.hasOwnProperty(r)&&(o[r]=t[r]);if(e&&e.defaultProps)for(r in t=e.defaultProps,t)o[r]===void 0&&(o[r]=t[r]);return{$$typeof:cm,type:e,key:l,ref:i,props:o,_owner:pm.current}}xl.Fragment=dm;xl.jsx=Tc;xl.jsxs=Tc;kc.exports=xl;var s=kc.exports,Bi={},bc={exports:{}},We={},Mc={exports:{}},Oc={};/**
 * @license React
 * scheduler.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */(function(e){function t(R,O){var T=R.length;R.push(O);e:for(;0<T;){var $=T-1>>>1,Q=R[$];if(0<o(Q,O))R[$]=O,R[T]=Q,T=$;else break e}}function n(R){return R.length===0?null:R[0]}function r(R){if(R.length===0)return null;var O=R[0],T=R.pop();if(T!==O){R[0]=T;e:for(var $=0,Q=R.length,Ae=Q>>>1;$<Ae;){var P=2*($+1)-1,B=R[P],U=P+1,mt=R[U];if(0>o(B,T))U<Q&&0>o(mt,B)?(R[$]=mt,R[U]=T,$=U):(R[$]=B,R[P]=T,$=P);else if(U<Q&&0>o(mt,T))R[$]=mt,R[U]=T,$=U;else break e}}return O}function o(R,O){var T=R.sortIndex-O.sortIndex;return T!==0?T:R.id-O.id}if(typeof performance=="object"&&typeof performance.now=="function"){var l=performance;e.unstable_now=function(){return l.now()}}else{var i=Date,a=i.now();e.unstable_now=function(){return i.now()-a}}var u=[],c=[],d=1,f=null,h=3,_=!1,w=!1,v=!1,S=typeof setTimeout=="function"?setTimeout:null,p=typeof clearTimeout=="function"?clearTimeout:null,m=typeof setImmediate<"u"?setImmediate:null;typeof navigator<"u"&&navigator.scheduling!==void 0&&navigator.scheduling.isInputPending!==void 0&&navigator.scheduling.isInputPending.bind(navigator.scheduling);function y(R){for(var O=n(c);O!==null;){if(O.callback===null)r(c);else if(O.startTime<=R)r(c),O.sortIndex=O.expirationTime,t(u,O);else break;O=n(c)}}function x(R){if(v=!1,y(R),!w)if(n(u)!==null)w=!0,ue(k);else{var O=n(c);O!==null&&ze(x,O.startTime-R)}}function k(R,O){w=!1,v&&(v=!1,p(C),C=-1),_=!0;var T=h;try{for(y(O),f=n(u);f!==null&&(!(f.expirationTime>O)||R&&!A());){var $=f.callback;if(typeof $=="function"){f.callback=null,h=f.priorityLevel;var Q=$(f.expirationTime<=O);O=e.unstable_now(),typeof Q=="function"?f.callback=Q:f===n(u)&&r(u),y(O)}else r(u);f=n(u)}if(f!==null)var Ae=!0;else{var P=n(c);P!==null&&ze(x,P.startTime-O),Ae=!1}return Ae}finally{f=null,h=T,_=!1}}var E=!1,N=null,C=-1,z=5,I=-1;function A(){return!(e.unstable_now()-I<z)}function Z(){if(N!==null){var R=e.unstable_now();I=R;var O=!0;try{O=N(!0,R)}finally{O?ae():(E=!1,N=null)}}else E=!1}var ae;if(typeof m=="function")ae=function(){m(Z)};else if(typeof MessageChannel<"u"){var M=new MessageChannel,W=M.port2;M.port1.onmessage=Z,ae=function(){W.postMessage(null)}}else ae=function(){S(Z,0)};function ue(R){N=R,E||(E=!0,ae())}function ze(R,O){C=S(function(){R(e.unstable_now())},O)}e.unstable_IdlePriority=5,e.unstable_ImmediatePriority=1,e.unstable_LowPriority=4,e.unstable_NormalPriority=3,e.unstable_Profiling=null,e.unstable_UserBlockingPriority=2,e.unstable_cancelCallback=function(R){R.callback=null},e.unstable_continueExecution=function(){w||_||(w=!0,ue(k))},e.unstable_forceFrameRate=function(R){0>R||125<R?console.error("forceFrameRate takes a positive int between 0 and 125, forcing frame rates higher than 125 fps is not supported"):z=0<R?Math.floor(1e3/R):5},e.unstable_getCurrentPriorityLevel=function(){return h},e.unstable_getFirstCallbackNode=function(){return n(u)},e.unstable_next=function(R){switch(h){case 1:case 2:case 3:var O=3;break;default:O=h}var T=h;h=O;try{return R()}finally{h=T}},e.unstable_pauseExecution=function(){},e.unstable_requestPaint=function(){},e.unstable_runWithPriority=function(R,O){switch(R){case 1:case 2:case 3:case 4:case 5:break;default:R=3}var T=h;h=R;try{return O()}finally{h=T}},e.unstable_scheduleCallback=function(R,O,T){var $=e.unstable_now();switch(typeof T=="object"&&T!==null?(T=T.delay,T=typeof T=="number"&&0<T?$+T:$):T=$,R){case 1:var Q=-1;break;case 2:Q=250;break;case 5:Q=1073741823;break;case 4:Q=1e4;break;default:Q=5e3}return Q=T+Q,R={id:d++,callback:O,priorityLevel:R,startTime:T,expirationTime:Q,sortIndex:-1},T>$?(R.sortIndex=T,t(c,R),n(u)===null&&R===n(c)&&(v?(p(C),C=-1):v=!0,ze(x,T-$))):(R.sortIndex=Q,t(u,R),w||_||(w=!0,ue(k))),R},e.unstable_shouldYield=A,e.unstable_wrapCallback=function(R){var O=h;return function(){var T=h;h=O;try{return R.apply(this,arguments)}finally{h=T}}}})(Oc);Mc.exports=Oc;var hm=Mc.exports;/**
 * @license React
 * react-dom.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var ym=g,He=hm;function j(e){for(var t="https://reactjs.org/docs/error-decoder.html?invariant="+e,n=1;n<arguments.length;n++)t+="&args[]="+encodeURIComponent(arguments[n]);return"Minified React error #"+e+"; visit "+t+" for the full message or use the non-minified dev environment for full errors and additional helpful warnings."}var zc=new Set,Tr={};function wn(e,t){Qn(e,t),Qn(e+"Capture",t)}function Qn(e,t){for(Tr[e]=t,e=0;e<t.length;e++)zc.add(t[e])}var Pt=!(typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"),Fi=Object.prototype.hasOwnProperty,gm=/^[:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD][:A-Z_a-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\-.0-9\u00B7\u0300-\u036F\u203F-\u2040]*$/,Ya={},Xa={};function vm(e){return Fi.call(Xa,e)?!0:Fi.call(Ya,e)?!1:gm.test(e)?Xa[e]=!0:(Ya[e]=!0,!1)}function _m(e,t,n,r){if(n!==null&&n.type===0)return!1;switch(typeof t){case"function":case"symbol":return!0;case"boolean":return r?!1:n!==null?!n.acceptsBooleans:(e=e.toLowerCase().slice(0,5),e!=="data-"&&e!=="aria-");default:return!1}}function wm(e,t,n,r){if(t===null||typeof t>"u"||_m(e,t,n,r))return!0;if(r)return!1;if(n!==null)switch(n.type){case 3:return!t;case 4:return t===!1;case 5:return isNaN(t);case 6:return isNaN(t)||1>t}return!1}function Le(e,t,n,r,o,l,i){this.acceptsBooleans=t===2||t===3||t===4,this.attributeName=r,this.attributeNamespace=o,this.mustUseProperty=n,this.propertyName=e,this.type=t,this.sanitizeURL=l,this.removeEmptyString=i}var we={};"children dangerouslySetInnerHTML defaultValue defaultChecked innerHTML suppressContentEditableWarning suppressHydrationWarning style".split(" ").forEach(function(e){we[e]=new Le(e,0,!1,e,null,!1,!1)});[["acceptCharset","accept-charset"],["className","class"],["htmlFor","for"],["httpEquiv","http-equiv"]].forEach(function(e){var t=e[0];we[t]=new Le(t,1,!1,e[1],null,!1,!1)});["contentEditable","draggable","spellCheck","value"].forEach(function(e){we[e]=new Le(e,2,!1,e.toLowerCase(),null,!1,!1)});["autoReverse","externalResourcesRequired","focusable","preserveAlpha"].forEach(function(e){we[e]=new Le(e,2,!1,e,null,!1,!1)});"allowFullScreen async autoFocus autoPlay controls default defer disabled disablePictureInPicture disableRemotePlayback formNoValidate hidden loop noModule noValidate open playsInline readOnly required reversed scoped seamless itemScope".split(" ").forEach(function(e){we[e]=new Le(e,3,!1,e.toLowerCase(),null,!1,!1)});["checked","multiple","muted","selected"].forEach(function(e){we[e]=new Le(e,3,!0,e,null,!1,!1)});["capture","download"].forEach(function(e){we[e]=new Le(e,4,!1,e,null,!1,!1)});["cols","rows","size","span"].forEach(function(e){we[e]=new Le(e,6,!1,e,null,!1,!1)});["rowSpan","start"].forEach(function(e){we[e]=new Le(e,5,!1,e.toLowerCase(),null,!1,!1)});var Bs=/[\-:]([a-z])/g;function Fs(e){return e[1].toUpperCase()}"accent-height alignment-baseline arabic-form baseline-shift cap-height clip-path clip-rule color-interpolation color-interpolation-filters color-profile color-rendering dominant-baseline enable-background fill-opacity fill-rule flood-color flood-opacity font-family font-size font-size-adjust font-stretch font-style font-variant font-weight glyph-name glyph-orientation-horizontal glyph-orientation-vertical horiz-adv-x horiz-origin-x image-rendering letter-spacing lighting-color marker-end marker-mid marker-start overline-position overline-thickness paint-order panose-1 pointer-events rendering-intent shape-rendering stop-color stop-opacity strikethrough-position strikethrough-thickness stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width text-anchor text-decoration text-rendering underline-position underline-thickness unicode-bidi unicode-range units-per-em v-alphabetic v-hanging v-ideographic v-mathematical vector-effect vert-adv-y vert-origin-x vert-origin-y word-spacing writing-mode xmlns:xlink x-height".split(" ").forEach(function(e){var t=e.replace(Bs,Fs);we[t]=new Le(t,1,!1,e,null,!1,!1)});"xlink:actuate xlink:arcrole xlink:role xlink:show xlink:title xlink:type".split(" ").forEach(function(e){var t=e.replace(Bs,Fs);we[t]=new Le(t,1,!1,e,"http://www.w3.org/1999/xlink",!1,!1)});["xml:base","xml:lang","xml:space"].forEach(function(e){var t=e.replace(Bs,Fs);we[t]=new Le(t,1,!1,e,"http://www.w3.org/XML/1998/namespace",!1,!1)});["tabIndex","crossOrigin"].forEach(function(e){we[e]=new Le(e,1,!1,e.toLowerCase(),null,!1,!1)});we.xlinkHref=new Le("xlinkHref",1,!1,"xlink:href","http://www.w3.org/1999/xlink",!0,!1);["src","href","action","formAction"].forEach(function(e){we[e]=new Le(e,1,!1,e.toLowerCase(),null,!0,!0)});function Ds(e,t,n,r){var o=we.hasOwnProperty(t)?we[t]:null;(o!==null?o.type!==0:r||!(2<t.length)||t[0]!=="o"&&t[0]!=="O"||t[1]!=="n"&&t[1]!=="N")&&(wm(t,n,o,r)&&(n=null),r||o===null?vm(t)&&(n===null?e.removeAttribute(t):e.setAttribute(t,""+n)):o.mustUseProperty?e[o.propertyName]=n===null?o.type===3?!1:"":n:(t=o.attributeName,r=o.attributeNamespace,n===null?e.removeAttribute(t):(o=o.type,n=o===3||o===4&&n===!0?"":""+n,r?e.setAttributeNS(r,t,n):e.setAttribute(t,n))))}var bt=ym.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED,uo=Symbol.for("react.element"),Rn=Symbol.for("react.portal"),Pn=Symbol.for("react.fragment"),Us=Symbol.for("react.strict_mode"),Di=Symbol.for("react.profiler"),Ac=Symbol.for("react.provider"),Bc=Symbol.for("react.context"),Hs=Symbol.for("react.forward_ref"),Ui=Symbol.for("react.suspense"),Hi=Symbol.for("react.suspense_list"),Vs=Symbol.for("react.memo"),Ot=Symbol.for("react.lazy"),Fc=Symbol.for("react.offscreen"),Ja=Symbol.iterator;function sr(e){return e===null||typeof e!="object"?null:(e=Ja&&e[Ja]||e["@@iterator"],typeof e=="function"?e:null)}var ie=Object.assign,ai;function _r(e){if(ai===void 0)try{throw Error()}catch(n){var t=n.stack.trim().match(/\n( *(at )?)/);ai=t&&t[1]||""}return`
`+ai+e}var ui=!1;function ci(e,t){if(!e||ui)return"";ui=!0;var n=Error.prepareStackTrace;Error.prepareStackTrace=void 0;try{if(t)if(t=function(){throw Error()},Object.defineProperty(t.prototype,"props",{set:function(){throw Error()}}),typeof Reflect=="object"&&Reflect.construct){try{Reflect.construct(t,[])}catch(c){var r=c}Reflect.construct(e,[],t)}else{try{t.call()}catch(c){r=c}e.call(t.prototype)}else{try{throw Error()}catch(c){r=c}e()}}catch(c){if(c&&r&&typeof c.stack=="string"){for(var o=c.stack.split(`
`),l=r.stack.split(`
`),i=o.length-1,a=l.length-1;1<=i&&0<=a&&o[i]!==l[a];)a--;for(;1<=i&&0<=a;i--,a--)if(o[i]!==l[a]){if(i!==1||a!==1)do if(i--,a--,0>a||o[i]!==l[a]){var u=`
`+o[i].replace(" at new "," at ");return e.displayName&&u.includes("<anonymous>")&&(u=u.replace("<anonymous>",e.displayName)),u}while(1<=i&&0<=a);break}}}finally{ui=!1,Error.prepareStackTrace=n}return(e=e?e.displayName||e.name:"")?_r(e):""}function xm(e){switch(e.tag){case 5:return _r(e.type);case 16:return _r("Lazy");case 13:return _r("Suspense");case 19:return _r("SuspenseList");case 0:case 2:case 15:return e=ci(e.type,!1),e;case 11:return e=ci(e.type.render,!1),e;case 1:return e=ci(e.type,!0),e;default:return""}}function Vi(e){if(e==null)return null;if(typeof e=="function")return e.displayName||e.name||null;if(typeof e=="string")return e;switch(e){case Pn:return"Fragment";case Rn:return"Portal";case Di:return"Profiler";case Us:return"StrictMode";case Ui:return"Suspense";case Hi:return"SuspenseList"}if(typeof e=="object")switch(e.$$typeof){case Bc:return(e.displayName||"Context")+".Consumer";case Ac:return(e._context.displayName||"Context")+".Provider";case Hs:var t=e.render;return e=e.displayName,e||(e=t.displayName||t.name||"",e=e!==""?"ForwardRef("+e+")":"ForwardRef"),e;case Vs:return t=e.displayName||null,t!==null?t:Vi(e.type)||"Memo";case Ot:t=e._payload,e=e._init;try{return Vi(e(t))}catch{}}return null}function Sm(e){var t=e.type;switch(e.tag){case 24:return"Cache";case 9:return(t.displayName||"Context")+".Consumer";case 10:return(t._context.displayName||"Context")+".Provider";case 18:return"DehydratedFragment";case 11:return e=t.render,e=e.displayName||e.name||"",t.displayName||(e!==""?"ForwardRef("+e+")":"ForwardRef");case 7:return"Fragment";case 5:return t;case 4:return"Portal";case 3:return"Root";case 6:return"Text";case 16:return Vi(t);case 8:return t===Us?"StrictMode":"Mode";case 22:return"Offscreen";case 12:return"Profiler";case 21:return"Scope";case 13:return"Suspense";case 19:return"SuspenseList";case 25:return"TracingMarker";case 1:case 0:case 17:case 2:case 14:case 15:if(typeof t=="function")return t.displayName||t.name||null;if(typeof t=="string")return t}return null}function Yt(e){switch(typeof e){case"boolean":case"number":case"string":case"undefined":return e;case"object":return e;default:return""}}function Dc(e){var t=e.type;return(e=e.nodeName)&&e.toLowerCase()==="input"&&(t==="checkbox"||t==="radio")}function km(e){var t=Dc(e)?"checked":"value",n=Object.getOwnPropertyDescriptor(e.constructor.prototype,t),r=""+e[t];if(!e.hasOwnProperty(t)&&typeof n<"u"&&typeof n.get=="function"&&typeof n.set=="function"){var o=n.get,l=n.set;return Object.defineProperty(e,t,{configurable:!0,get:function(){return o.call(this)},set:function(i){r=""+i,l.call(this,i)}}),Object.defineProperty(e,t,{enumerable:n.enumerable}),{getValue:function(){return r},setValue:function(i){r=""+i},stopTracking:function(){e._valueTracker=null,delete e[t]}}}}function co(e){e._valueTracker||(e._valueTracker=km(e))}function Uc(e){if(!e)return!1;var t=e._valueTracker;if(!t)return!0;var n=t.getValue(),r="";return e&&(r=Dc(e)?e.checked?"true":"false":e.value),e=r,e!==n?(t.setValue(e),!0):!1}function Ho(e){if(e=e||(typeof document<"u"?document:void 0),typeof e>"u")return null;try{return e.activeElement||e.body}catch{return e.body}}function Wi(e,t){var n=t.checked;return ie({},t,{defaultChecked:void 0,defaultValue:void 0,value:void 0,checked:n??e._wrapperState.initialChecked})}function Za(e,t){var n=t.defaultValue==null?"":t.defaultValue,r=t.checked!=null?t.checked:t.defaultChecked;n=Yt(t.value!=null?t.value:n),e._wrapperState={initialChecked:r,initialValue:n,controlled:t.type==="checkbox"||t.type==="radio"?t.checked!=null:t.value!=null}}function Hc(e,t){t=t.checked,t!=null&&Ds(e,"checked",t,!1)}function Qi(e,t){Hc(e,t);var n=Yt(t.value),r=t.type;if(n!=null)r==="number"?(n===0&&e.value===""||e.value!=n)&&(e.value=""+n):e.value!==""+n&&(e.value=""+n);else if(r==="submit"||r==="reset"){e.removeAttribute("value");return}t.hasOwnProperty("value")?qi(e,t.type,n):t.hasOwnProperty("defaultValue")&&qi(e,t.type,Yt(t.defaultValue)),t.checked==null&&t.defaultChecked!=null&&(e.defaultChecked=!!t.defaultChecked)}function eu(e,t,n){if(t.hasOwnProperty("value")||t.hasOwnProperty("defaultValue")){var r=t.type;if(!(r!=="submit"&&r!=="reset"||t.value!==void 0&&t.value!==null))return;t=""+e._wrapperState.initialValue,n||t===e.value||(e.value=t),e.defaultValue=t}n=e.name,n!==""&&(e.name=""),e.defaultChecked=!!e._wrapperState.initialChecked,n!==""&&(e.name=n)}function qi(e,t,n){(t!=="number"||Ho(e.ownerDocument)!==e)&&(n==null?e.defaultValue=""+e._wrapperState.initialValue:e.defaultValue!==""+n&&(e.defaultValue=""+n))}var wr=Array.isArray;function Fn(e,t,n,r){if(e=e.options,t){t={};for(var o=0;o<n.length;o++)t["$"+n[o]]=!0;for(n=0;n<e.length;n++)o=t.hasOwnProperty("$"+e[n].value),e[n].selected!==o&&(e[n].selected=o),o&&r&&(e[n].defaultSelected=!0)}else{for(n=""+Yt(n),t=null,o=0;o<e.length;o++){if(e[o].value===n){e[o].selected=!0,r&&(e[o].defaultSelected=!0);return}t!==null||e[o].disabled||(t=e[o])}t!==null&&(t.selected=!0)}}function Ki(e,t){if(t.dangerouslySetInnerHTML!=null)throw Error(j(91));return ie({},t,{value:void 0,defaultValue:void 0,children:""+e._wrapperState.initialValue})}function tu(e,t){var n=t.value;if(n==null){if(n=t.children,t=t.defaultValue,n!=null){if(t!=null)throw Error(j(92));if(wr(n)){if(1<n.length)throw Error(j(93));n=n[0]}t=n}t==null&&(t=""),n=t}e._wrapperState={initialValue:Yt(n)}}function Vc(e,t){var n=Yt(t.value),r=Yt(t.defaultValue);n!=null&&(n=""+n,n!==e.value&&(e.value=n),t.defaultValue==null&&e.defaultValue!==n&&(e.defaultValue=n)),r!=null&&(e.defaultValue=""+r)}function nu(e){var t=e.textContent;t===e._wrapperState.initialValue&&t!==""&&t!==null&&(e.value=t)}function Wc(e){switch(e){case"svg":return"http://www.w3.org/2000/svg";case"math":return"http://www.w3.org/1998/Math/MathML";default:return"http://www.w3.org/1999/xhtml"}}function Gi(e,t){return e==null||e==="http://www.w3.org/1999/xhtml"?Wc(t):e==="http://www.w3.org/2000/svg"&&t==="foreignObject"?"http://www.w3.org/1999/xhtml":e}var fo,Qc=function(e){return typeof MSApp<"u"&&MSApp.execUnsafeLocalFunction?function(t,n,r,o){MSApp.execUnsafeLocalFunction(function(){return e(t,n,r,o)})}:e}(function(e,t){if(e.namespaceURI!=="http://www.w3.org/2000/svg"||"innerHTML"in e)e.innerHTML=t;else{for(fo=fo||document.createElement("div"),fo.innerHTML="<svg>"+t.valueOf().toString()+"</svg>",t=fo.firstChild;e.firstChild;)e.removeChild(e.firstChild);for(;t.firstChild;)e.appendChild(t.firstChild)}});function br(e,t){if(t){var n=e.firstChild;if(n&&n===e.lastChild&&n.nodeType===3){n.nodeValue=t;return}}e.textContent=t}var Er={animationIterationCount:!0,aspectRatio:!0,borderImageOutset:!0,borderImageSlice:!0,borderImageWidth:!0,boxFlex:!0,boxFlexGroup:!0,boxOrdinalGroup:!0,columnCount:!0,columns:!0,flex:!0,flexGrow:!0,flexPositive:!0,flexShrink:!0,flexNegative:!0,flexOrder:!0,gridArea:!0,gridRow:!0,gridRowEnd:!0,gridRowSpan:!0,gridRowStart:!0,gridColumn:!0,gridColumnEnd:!0,gridColumnSpan:!0,gridColumnStart:!0,fontWeight:!0,lineClamp:!0,lineHeight:!0,opacity:!0,order:!0,orphans:!0,tabSize:!0,widows:!0,zIndex:!0,zoom:!0,fillOpacity:!0,floodOpacity:!0,stopOpacity:!0,strokeDasharray:!0,strokeDashoffset:!0,strokeMiterlimit:!0,strokeOpacity:!0,strokeWidth:!0},Em=["Webkit","ms","Moz","O"];Object.keys(Er).forEach(function(e){Em.forEach(function(t){t=t+e.charAt(0).toUpperCase()+e.substring(1),Er[t]=Er[e]})});function qc(e,t,n){return t==null||typeof t=="boolean"||t===""?"":n||typeof t!="number"||t===0||Er.hasOwnProperty(e)&&Er[e]?(""+t).trim():t+"px"}function Kc(e,t){e=e.style;for(var n in t)if(t.hasOwnProperty(n)){var r=n.indexOf("--")===0,o=qc(n,t[n],r);n==="float"&&(n="cssFloat"),r?e.setProperty(n,o):e[n]=o}}var jm=ie({menuitem:!0},{area:!0,base:!0,br:!0,col:!0,embed:!0,hr:!0,img:!0,input:!0,keygen:!0,link:!0,meta:!0,param:!0,source:!0,track:!0,wbr:!0});function Yi(e,t){if(t){if(jm[e]&&(t.children!=null||t.dangerouslySetInnerHTML!=null))throw Error(j(137,e));if(t.dangerouslySetInnerHTML!=null){if(t.children!=null)throw Error(j(60));if(typeof t.dangerouslySetInnerHTML!="object"||!("__html"in t.dangerouslySetInnerHTML))throw Error(j(61))}if(t.style!=null&&typeof t.style!="object")throw Error(j(62))}}function Xi(e,t){if(e.indexOf("-")===-1)return typeof t.is=="string";switch(e){case"annotation-xml":case"color-profile":case"font-face":case"font-face-src":case"font-face-uri":case"font-face-format":case"font-face-name":case"missing-glyph":return!1;default:return!0}}var Ji=null;function Ws(e){return e=e.target||e.srcElement||window,e.correspondingUseElement&&(e=e.correspondingUseElement),e.nodeType===3?e.parentNode:e}var Zi=null,Dn=null,Un=null;function ru(e){if(e=no(e)){if(typeof Zi!="function")throw Error(j(280));var t=e.stateNode;t&&(t=Cl(t),Zi(e.stateNode,e.type,t))}}function Gc(e){Dn?Un?Un.push(e):Un=[e]:Dn=e}function Yc(){if(Dn){var e=Dn,t=Un;if(Un=Dn=null,ru(e),t)for(e=0;e<t.length;e++)ru(t[e])}}function Xc(e,t){return e(t)}function Jc(){}var di=!1;function Zc(e,t,n){if(di)return e(t,n);di=!0;try{return Xc(e,t,n)}finally{di=!1,(Dn!==null||Un!==null)&&(Jc(),Yc())}}function Mr(e,t){var n=e.stateNode;if(n===null)return null;var r=Cl(n);if(r===null)return null;n=r[t];e:switch(t){case"onClick":case"onClickCapture":case"onDoubleClick":case"onDoubleClickCapture":case"onMouseDown":case"onMouseDownCapture":case"onMouseMove":case"onMouseMoveCapture":case"onMouseUp":case"onMouseUpCapture":case"onMouseEnter":(r=!r.disabled)||(e=e.type,r=!(e==="button"||e==="input"||e==="select"||e==="textarea")),e=!r;break e;default:e=!1}if(e)return null;if(n&&typeof n!="function")throw Error(j(231,t,typeof n));return n}var es=!1;if(Pt)try{var ar={};Object.defineProperty(ar,"passive",{get:function(){es=!0}}),window.addEventListener("test",ar,ar),window.removeEventListener("test",ar,ar)}catch{es=!1}function Cm(e,t,n,r,o,l,i,a,u){var c=Array.prototype.slice.call(arguments,3);try{t.apply(n,c)}catch(d){this.onError(d)}}var jr=!1,Vo=null,Wo=!1,ts=null,Nm={onError:function(e){jr=!0,Vo=e}};function Rm(e,t,n,r,o,l,i,a,u){jr=!1,Vo=null,Cm.apply(Nm,arguments)}function Pm(e,t,n,r,o,l,i,a,u){if(Rm.apply(this,arguments),jr){if(jr){var c=Vo;jr=!1,Vo=null}else throw Error(j(198));Wo||(Wo=!0,ts=c)}}function xn(e){var t=e,n=e;if(e.alternate)for(;t.return;)t=t.return;else{e=t;do t=e,t.flags&4098&&(n=t.return),e=t.return;while(e)}return t.tag===3?n:null}function ed(e){if(e.tag===13){var t=e.memoizedState;if(t===null&&(e=e.alternate,e!==null&&(t=e.memoizedState)),t!==null)return t.dehydrated}return null}function ou(e){if(xn(e)!==e)throw Error(j(188))}function Lm(e){var t=e.alternate;if(!t){if(t=xn(e),t===null)throw Error(j(188));return t!==e?null:e}for(var n=e,r=t;;){var o=n.return;if(o===null)break;var l=o.alternate;if(l===null){if(r=o.return,r!==null){n=r;continue}break}if(o.child===l.child){for(l=o.child;l;){if(l===n)return ou(o),e;if(l===r)return ou(o),t;l=l.sibling}throw Error(j(188))}if(n.return!==r.return)n=o,r=l;else{for(var i=!1,a=o.child;a;){if(a===n){i=!0,n=o,r=l;break}if(a===r){i=!0,r=o,n=l;break}a=a.sibling}if(!i){for(a=l.child;a;){if(a===n){i=!0,n=l,r=o;break}if(a===r){i=!0,r=l,n=o;break}a=a.sibling}if(!i)throw Error(j(189))}}if(n.alternate!==r)throw Error(j(190))}if(n.tag!==3)throw Error(j(188));return n.stateNode.current===n?e:t}function td(e){return e=Lm(e),e!==null?nd(e):null}function nd(e){if(e.tag===5||e.tag===6)return e;for(e=e.child;e!==null;){var t=nd(e);if(t!==null)return t;e=e.sibling}return null}var rd=He.unstable_scheduleCallback,lu=He.unstable_cancelCallback,Im=He.unstable_shouldYield,$m=He.unstable_requestPaint,ce=He.unstable_now,Tm=He.unstable_getCurrentPriorityLevel,Qs=He.unstable_ImmediatePriority,od=He.unstable_UserBlockingPriority,Qo=He.unstable_NormalPriority,bm=He.unstable_LowPriority,ld=He.unstable_IdlePriority,Sl=null,_t=null;function Mm(e){if(_t&&typeof _t.onCommitFiberRoot=="function")try{_t.onCommitFiberRoot(Sl,e,void 0,(e.current.flags&128)===128)}catch{}}var ut=Math.clz32?Math.clz32:Am,Om=Math.log,zm=Math.LN2;function Am(e){return e>>>=0,e===0?32:31-(Om(e)/zm|0)|0}var po=64,mo=4194304;function xr(e){switch(e&-e){case 1:return 1;case 2:return 2;case 4:return 4;case 8:return 8;case 16:return 16;case 32:return 32;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return e&4194240;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return e&130023424;case 134217728:return 134217728;case 268435456:return 268435456;case 536870912:return 536870912;case 1073741824:return 1073741824;default:return e}}function qo(e,t){var n=e.pendingLanes;if(n===0)return 0;var r=0,o=e.suspendedLanes,l=e.pingedLanes,i=n&268435455;if(i!==0){var a=i&~o;a!==0?r=xr(a):(l&=i,l!==0&&(r=xr(l)))}else i=n&~o,i!==0?r=xr(i):l!==0&&(r=xr(l));if(r===0)return 0;if(t!==0&&t!==r&&!(t&o)&&(o=r&-r,l=t&-t,o>=l||o===16&&(l&4194240)!==0))return t;if(r&4&&(r|=n&16),t=e.entangledLanes,t!==0)for(e=e.entanglements,t&=r;0<t;)n=31-ut(t),o=1<<n,r|=e[n],t&=~o;return r}function Bm(e,t){switch(e){case 1:case 2:case 4:return t+250;case 8:case 16:case 32:case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:return t+5e3;case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:return-1;case 134217728:case 268435456:case 536870912:case 1073741824:return-1;default:return-1}}function Fm(e,t){for(var n=e.suspendedLanes,r=e.pingedLanes,o=e.expirationTimes,l=e.pendingLanes;0<l;){var i=31-ut(l),a=1<<i,u=o[i];u===-1?(!(a&n)||a&r)&&(o[i]=Bm(a,t)):u<=t&&(e.expiredLanes|=a),l&=~a}}function ns(e){return e=e.pendingLanes&-1073741825,e!==0?e:e&1073741824?1073741824:0}function id(){var e=po;return po<<=1,!(po&4194240)&&(po=64),e}function fi(e){for(var t=[],n=0;31>n;n++)t.push(e);return t}function eo(e,t,n){e.pendingLanes|=t,t!==536870912&&(e.suspendedLanes=0,e.pingedLanes=0),e=e.eventTimes,t=31-ut(t),e[t]=n}function Dm(e,t){var n=e.pendingLanes&~t;e.pendingLanes=t,e.suspendedLanes=0,e.pingedLanes=0,e.expiredLanes&=t,e.mutableReadLanes&=t,e.entangledLanes&=t,t=e.entanglements;var r=e.eventTimes;for(e=e.expirationTimes;0<n;){var o=31-ut(n),l=1<<o;t[o]=0,r[o]=-1,e[o]=-1,n&=~l}}function qs(e,t){var n=e.entangledLanes|=t;for(e=e.entanglements;n;){var r=31-ut(n),o=1<<r;o&t|e[r]&t&&(e[r]|=t),n&=~o}}var K=0;function sd(e){return e&=-e,1<e?4<e?e&268435455?16:536870912:4:1}var ad,Ks,ud,cd,dd,rs=!1,ho=[],Ut=null,Ht=null,Vt=null,Or=new Map,zr=new Map,At=[],Um="mousedown mouseup touchcancel touchend touchstart auxclick dblclick pointercancel pointerdown pointerup dragend dragstart drop compositionend compositionstart keydown keypress keyup input textInput copy cut paste click change contextmenu reset submit".split(" ");function iu(e,t){switch(e){case"focusin":case"focusout":Ut=null;break;case"dragenter":case"dragleave":Ht=null;break;case"mouseover":case"mouseout":Vt=null;break;case"pointerover":case"pointerout":Or.delete(t.pointerId);break;case"gotpointercapture":case"lostpointercapture":zr.delete(t.pointerId)}}function ur(e,t,n,r,o,l){return e===null||e.nativeEvent!==l?(e={blockedOn:t,domEventName:n,eventSystemFlags:r,nativeEvent:l,targetContainers:[o]},t!==null&&(t=no(t),t!==null&&Ks(t)),e):(e.eventSystemFlags|=r,t=e.targetContainers,o!==null&&t.indexOf(o)===-1&&t.push(o),e)}function Hm(e,t,n,r,o){switch(t){case"focusin":return Ut=ur(Ut,e,t,n,r,o),!0;case"dragenter":return Ht=ur(Ht,e,t,n,r,o),!0;case"mouseover":return Vt=ur(Vt,e,t,n,r,o),!0;case"pointerover":var l=o.pointerId;return Or.set(l,ur(Or.get(l)||null,e,t,n,r,o)),!0;case"gotpointercapture":return l=o.pointerId,zr.set(l,ur(zr.get(l)||null,e,t,n,r,o)),!0}return!1}function fd(e){var t=an(e.target);if(t!==null){var n=xn(t);if(n!==null){if(t=n.tag,t===13){if(t=ed(n),t!==null){e.blockedOn=t,dd(e.priority,function(){ud(n)});return}}else if(t===3&&n.stateNode.current.memoizedState.isDehydrated){e.blockedOn=n.tag===3?n.stateNode.containerInfo:null;return}}}e.blockedOn=null}function Io(e){if(e.blockedOn!==null)return!1;for(var t=e.targetContainers;0<t.length;){var n=os(e.domEventName,e.eventSystemFlags,t[0],e.nativeEvent);if(n===null){n=e.nativeEvent;var r=new n.constructor(n.type,n);Ji=r,n.target.dispatchEvent(r),Ji=null}else return t=no(n),t!==null&&Ks(t),e.blockedOn=n,!1;t.shift()}return!0}function su(e,t,n){Io(e)&&n.delete(t)}function Vm(){rs=!1,Ut!==null&&Io(Ut)&&(Ut=null),Ht!==null&&Io(Ht)&&(Ht=null),Vt!==null&&Io(Vt)&&(Vt=null),Or.forEach(su),zr.forEach(su)}function cr(e,t){e.blockedOn===t&&(e.blockedOn=null,rs||(rs=!0,He.unstable_scheduleCallback(He.unstable_NormalPriority,Vm)))}function Ar(e){function t(o){return cr(o,e)}if(0<ho.length){cr(ho[0],e);for(var n=1;n<ho.length;n++){var r=ho[n];r.blockedOn===e&&(r.blockedOn=null)}}for(Ut!==null&&cr(Ut,e),Ht!==null&&cr(Ht,e),Vt!==null&&cr(Vt,e),Or.forEach(t),zr.forEach(t),n=0;n<At.length;n++)r=At[n],r.blockedOn===e&&(r.blockedOn=null);for(;0<At.length&&(n=At[0],n.blockedOn===null);)fd(n),n.blockedOn===null&&At.shift()}var Hn=bt.ReactCurrentBatchConfig,Ko=!0;function Wm(e,t,n,r){var o=K,l=Hn.transition;Hn.transition=null;try{K=1,Gs(e,t,n,r)}finally{K=o,Hn.transition=l}}function Qm(e,t,n,r){var o=K,l=Hn.transition;Hn.transition=null;try{K=4,Gs(e,t,n,r)}finally{K=o,Hn.transition=l}}function Gs(e,t,n,r){if(Ko){var o=os(e,t,n,r);if(o===null)Si(e,t,r,Go,n),iu(e,r);else if(Hm(o,e,t,n,r))r.stopPropagation();else if(iu(e,r),t&4&&-1<Um.indexOf(e)){for(;o!==null;){var l=no(o);if(l!==null&&ad(l),l=os(e,t,n,r),l===null&&Si(e,t,r,Go,n),l===o)break;o=l}o!==null&&r.stopPropagation()}else Si(e,t,r,null,n)}}var Go=null;function os(e,t,n,r){if(Go=null,e=Ws(r),e=an(e),e!==null)if(t=xn(e),t===null)e=null;else if(n=t.tag,n===13){if(e=ed(t),e!==null)return e;e=null}else if(n===3){if(t.stateNode.current.memoizedState.isDehydrated)return t.tag===3?t.stateNode.containerInfo:null;e=null}else t!==e&&(e=null);return Go=e,null}function pd(e){switch(e){case"cancel":case"click":case"close":case"contextmenu":case"copy":case"cut":case"auxclick":case"dblclick":case"dragend":case"dragstart":case"drop":case"focusin":case"focusout":case"input":case"invalid":case"keydown":case"keypress":case"keyup":case"mousedown":case"mouseup":case"paste":case"pause":case"play":case"pointercancel":case"pointerdown":case"pointerup":case"ratechange":case"reset":case"resize":case"seeked":case"submit":case"touchcancel":case"touchend":case"touchstart":case"volumechange":case"change":case"selectionchange":case"textInput":case"compositionstart":case"compositionend":case"compositionupdate":case"beforeblur":case"afterblur":case"beforeinput":case"blur":case"fullscreenchange":case"focus":case"hashchange":case"popstate":case"select":case"selectstart":return 1;case"drag":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"mousemove":case"mouseout":case"mouseover":case"pointermove":case"pointerout":case"pointerover":case"scroll":case"toggle":case"touchmove":case"wheel":case"mouseenter":case"mouseleave":case"pointerenter":case"pointerleave":return 4;case"message":switch(Tm()){case Qs:return 1;case od:return 4;case Qo:case bm:return 16;case ld:return 536870912;default:return 16}default:return 16}}var Ft=null,Ys=null,$o=null;function md(){if($o)return $o;var e,t=Ys,n=t.length,r,o="value"in Ft?Ft.value:Ft.textContent,l=o.length;for(e=0;e<n&&t[e]===o[e];e++);var i=n-e;for(r=1;r<=i&&t[n-r]===o[l-r];r++);return $o=o.slice(e,1<r?1-r:void 0)}function To(e){var t=e.keyCode;return"charCode"in e?(e=e.charCode,e===0&&t===13&&(e=13)):e=t,e===10&&(e=13),32<=e||e===13?e:0}function yo(){return!0}function au(){return!1}function Qe(e){function t(n,r,o,l,i){this._reactName=n,this._targetInst=o,this.type=r,this.nativeEvent=l,this.target=i,this.currentTarget=null;for(var a in e)e.hasOwnProperty(a)&&(n=e[a],this[a]=n?n(l):l[a]);return this.isDefaultPrevented=(l.defaultPrevented!=null?l.defaultPrevented:l.returnValue===!1)?yo:au,this.isPropagationStopped=au,this}return ie(t.prototype,{preventDefault:function(){this.defaultPrevented=!0;var n=this.nativeEvent;n&&(n.preventDefault?n.preventDefault():typeof n.returnValue!="unknown"&&(n.returnValue=!1),this.isDefaultPrevented=yo)},stopPropagation:function(){var n=this.nativeEvent;n&&(n.stopPropagation?n.stopPropagation():typeof n.cancelBubble!="unknown"&&(n.cancelBubble=!0),this.isPropagationStopped=yo)},persist:function(){},isPersistent:yo}),t}var tr={eventPhase:0,bubbles:0,cancelable:0,timeStamp:function(e){return e.timeStamp||Date.now()},defaultPrevented:0,isTrusted:0},Xs=Qe(tr),to=ie({},tr,{view:0,detail:0}),qm=Qe(to),pi,mi,dr,kl=ie({},to,{screenX:0,screenY:0,clientX:0,clientY:0,pageX:0,pageY:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,getModifierState:Js,button:0,buttons:0,relatedTarget:function(e){return e.relatedTarget===void 0?e.fromElement===e.srcElement?e.toElement:e.fromElement:e.relatedTarget},movementX:function(e){return"movementX"in e?e.movementX:(e!==dr&&(dr&&e.type==="mousemove"?(pi=e.screenX-dr.screenX,mi=e.screenY-dr.screenY):mi=pi=0,dr=e),pi)},movementY:function(e){return"movementY"in e?e.movementY:mi}}),uu=Qe(kl),Km=ie({},kl,{dataTransfer:0}),Gm=Qe(Km),Ym=ie({},to,{relatedTarget:0}),hi=Qe(Ym),Xm=ie({},tr,{animationName:0,elapsedTime:0,pseudoElement:0}),Jm=Qe(Xm),Zm=ie({},tr,{clipboardData:function(e){return"clipboardData"in e?e.clipboardData:window.clipboardData}}),eh=Qe(Zm),th=ie({},tr,{data:0}),cu=Qe(th),nh={Esc:"Escape",Spacebar:" ",Left:"ArrowLeft",Up:"ArrowUp",Right:"ArrowRight",Down:"ArrowDown",Del:"Delete",Win:"OS",Menu:"ContextMenu",Apps:"ContextMenu",Scroll:"ScrollLock",MozPrintableKey:"Unidentified"},rh={8:"Backspace",9:"Tab",12:"Clear",13:"Enter",16:"Shift",17:"Control",18:"Alt",19:"Pause",20:"CapsLock",27:"Escape",32:" ",33:"PageUp",34:"PageDown",35:"End",36:"Home",37:"ArrowLeft",38:"ArrowUp",39:"ArrowRight",40:"ArrowDown",45:"Insert",46:"Delete",112:"F1",113:"F2",114:"F3",115:"F4",116:"F5",117:"F6",118:"F7",119:"F8",120:"F9",121:"F10",122:"F11",123:"F12",144:"NumLock",145:"ScrollLock",224:"Meta"},oh={Alt:"altKey",Control:"ctrlKey",Meta:"metaKey",Shift:"shiftKey"};function lh(e){var t=this.nativeEvent;return t.getModifierState?t.getModifierState(e):(e=oh[e])?!!t[e]:!1}function Js(){return lh}var ih=ie({},to,{key:function(e){if(e.key){var t=nh[e.key]||e.key;if(t!=="Unidentified")return t}return e.type==="keypress"?(e=To(e),e===13?"Enter":String.fromCharCode(e)):e.type==="keydown"||e.type==="keyup"?rh[e.keyCode]||"Unidentified":""},code:0,location:0,ctrlKey:0,shiftKey:0,altKey:0,metaKey:0,repeat:0,locale:0,getModifierState:Js,charCode:function(e){return e.type==="keypress"?To(e):0},keyCode:function(e){return e.type==="keydown"||e.type==="keyup"?e.keyCode:0},which:function(e){return e.type==="keypress"?To(e):e.type==="keydown"||e.type==="keyup"?e.keyCode:0}}),sh=Qe(ih),ah=ie({},kl,{pointerId:0,width:0,height:0,pressure:0,tangentialPressure:0,tiltX:0,tiltY:0,twist:0,pointerType:0,isPrimary:0}),du=Qe(ah),uh=ie({},to,{touches:0,targetTouches:0,changedTouches:0,altKey:0,metaKey:0,ctrlKey:0,shiftKey:0,getModifierState:Js}),ch=Qe(uh),dh=ie({},tr,{propertyName:0,elapsedTime:0,pseudoElement:0}),fh=Qe(dh),ph=ie({},kl,{deltaX:function(e){return"deltaX"in e?e.deltaX:"wheelDeltaX"in e?-e.wheelDeltaX:0},deltaY:function(e){return"deltaY"in e?e.deltaY:"wheelDeltaY"in e?-e.wheelDeltaY:"wheelDelta"in e?-e.wheelDelta:0},deltaZ:0,deltaMode:0}),mh=Qe(ph),hh=[9,13,27,32],Zs=Pt&&"CompositionEvent"in window,Cr=null;Pt&&"documentMode"in document&&(Cr=document.documentMode);var yh=Pt&&"TextEvent"in window&&!Cr,hd=Pt&&(!Zs||Cr&&8<Cr&&11>=Cr),fu=" ",pu=!1;function yd(e,t){switch(e){case"keyup":return hh.indexOf(t.keyCode)!==-1;case"keydown":return t.keyCode!==229;case"keypress":case"mousedown":case"focusout":return!0;default:return!1}}function gd(e){return e=e.detail,typeof e=="object"&&"data"in e?e.data:null}var Ln=!1;function gh(e,t){switch(e){case"compositionend":return gd(t);case"keypress":return t.which!==32?null:(pu=!0,fu);case"textInput":return e=t.data,e===fu&&pu?null:e;default:return null}}function vh(e,t){if(Ln)return e==="compositionend"||!Zs&&yd(e,t)?(e=md(),$o=Ys=Ft=null,Ln=!1,e):null;switch(e){case"paste":return null;case"keypress":if(!(t.ctrlKey||t.altKey||t.metaKey)||t.ctrlKey&&t.altKey){if(t.char&&1<t.char.length)return t.char;if(t.which)return String.fromCharCode(t.which)}return null;case"compositionend":return hd&&t.locale!=="ko"?null:t.data;default:return null}}var _h={color:!0,date:!0,datetime:!0,"datetime-local":!0,email:!0,month:!0,number:!0,password:!0,range:!0,search:!0,tel:!0,text:!0,time:!0,url:!0,week:!0};function mu(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t==="input"?!!_h[e.type]:t==="textarea"}function vd(e,t,n,r){Gc(r),t=Yo(t,"onChange"),0<t.length&&(n=new Xs("onChange","change",null,n,r),e.push({event:n,listeners:t}))}var Nr=null,Br=null;function wh(e){Pd(e,0)}function El(e){var t=Tn(e);if(Uc(t))return e}function xh(e,t){if(e==="change")return t}var _d=!1;if(Pt){var yi;if(Pt){var gi="oninput"in document;if(!gi){var hu=document.createElement("div");hu.setAttribute("oninput","return;"),gi=typeof hu.oninput=="function"}yi=gi}else yi=!1;_d=yi&&(!document.documentMode||9<document.documentMode)}function yu(){Nr&&(Nr.detachEvent("onpropertychange",wd),Br=Nr=null)}function wd(e){if(e.propertyName==="value"&&El(Br)){var t=[];vd(t,Br,e,Ws(e)),Zc(wh,t)}}function Sh(e,t,n){e==="focusin"?(yu(),Nr=t,Br=n,Nr.attachEvent("onpropertychange",wd)):e==="focusout"&&yu()}function kh(e){if(e==="selectionchange"||e==="keyup"||e==="keydown")return El(Br)}function Eh(e,t){if(e==="click")return El(t)}function jh(e,t){if(e==="input"||e==="change")return El(t)}function Ch(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var ft=typeof Object.is=="function"?Object.is:Ch;function Fr(e,t){if(ft(e,t))return!0;if(typeof e!="object"||e===null||typeof t!="object"||t===null)return!1;var n=Object.keys(e),r=Object.keys(t);if(n.length!==r.length)return!1;for(r=0;r<n.length;r++){var o=n[r];if(!Fi.call(t,o)||!ft(e[o],t[o]))return!1}return!0}function gu(e){for(;e&&e.firstChild;)e=e.firstChild;return e}function vu(e,t){var n=gu(e);e=0;for(var r;n;){if(n.nodeType===3){if(r=e+n.textContent.length,e<=t&&r>=t)return{node:n,offset:t-e};e=r}e:{for(;n;){if(n.nextSibling){n=n.nextSibling;break e}n=n.parentNode}n=void 0}n=gu(n)}}function xd(e,t){return e&&t?e===t?!0:e&&e.nodeType===3?!1:t&&t.nodeType===3?xd(e,t.parentNode):"contains"in e?e.contains(t):e.compareDocumentPosition?!!(e.compareDocumentPosition(t)&16):!1:!1}function Sd(){for(var e=window,t=Ho();t instanceof e.HTMLIFrameElement;){try{var n=typeof t.contentWindow.location.href=="string"}catch{n=!1}if(n)e=t.contentWindow;else break;t=Ho(e.document)}return t}function ea(e){var t=e&&e.nodeName&&e.nodeName.toLowerCase();return t&&(t==="input"&&(e.type==="text"||e.type==="search"||e.type==="tel"||e.type==="url"||e.type==="password")||t==="textarea"||e.contentEditable==="true")}function Nh(e){var t=Sd(),n=e.focusedElem,r=e.selectionRange;if(t!==n&&n&&n.ownerDocument&&xd(n.ownerDocument.documentElement,n)){if(r!==null&&ea(n)){if(t=r.start,e=r.end,e===void 0&&(e=t),"selectionStart"in n)n.selectionStart=t,n.selectionEnd=Math.min(e,n.value.length);else if(e=(t=n.ownerDocument||document)&&t.defaultView||window,e.getSelection){e=e.getSelection();var o=n.textContent.length,l=Math.min(r.start,o);r=r.end===void 0?l:Math.min(r.end,o),!e.extend&&l>r&&(o=r,r=l,l=o),o=vu(n,l);var i=vu(n,r);o&&i&&(e.rangeCount!==1||e.anchorNode!==o.node||e.anchorOffset!==o.offset||e.focusNode!==i.node||e.focusOffset!==i.offset)&&(t=t.createRange(),t.setStart(o.node,o.offset),e.removeAllRanges(),l>r?(e.addRange(t),e.extend(i.node,i.offset)):(t.setEnd(i.node,i.offset),e.addRange(t)))}}for(t=[],e=n;e=e.parentNode;)e.nodeType===1&&t.push({element:e,left:e.scrollLeft,top:e.scrollTop});for(typeof n.focus=="function"&&n.focus(),n=0;n<t.length;n++)e=t[n],e.element.scrollLeft=e.left,e.element.scrollTop=e.top}}var Rh=Pt&&"documentMode"in document&&11>=document.documentMode,In=null,ls=null,Rr=null,is=!1;function _u(e,t,n){var r=n.window===n?n.document:n.nodeType===9?n:n.ownerDocument;is||In==null||In!==Ho(r)||(r=In,"selectionStart"in r&&ea(r)?r={start:r.selectionStart,end:r.selectionEnd}:(r=(r.ownerDocument&&r.ownerDocument.defaultView||window).getSelection(),r={anchorNode:r.anchorNode,anchorOffset:r.anchorOffset,focusNode:r.focusNode,focusOffset:r.focusOffset}),Rr&&Fr(Rr,r)||(Rr=r,r=Yo(ls,"onSelect"),0<r.length&&(t=new Xs("onSelect","select",null,t,n),e.push({event:t,listeners:r}),t.target=In)))}function go(e,t){var n={};return n[e.toLowerCase()]=t.toLowerCase(),n["Webkit"+e]="webkit"+t,n["Moz"+e]="moz"+t,n}var $n={animationend:go("Animation","AnimationEnd"),animationiteration:go("Animation","AnimationIteration"),animationstart:go("Animation","AnimationStart"),transitionend:go("Transition","TransitionEnd")},vi={},kd={};Pt&&(kd=document.createElement("div").style,"AnimationEvent"in window||(delete $n.animationend.animation,delete $n.animationiteration.animation,delete $n.animationstart.animation),"TransitionEvent"in window||delete $n.transitionend.transition);function jl(e){if(vi[e])return vi[e];if(!$n[e])return e;var t=$n[e],n;for(n in t)if(t.hasOwnProperty(n)&&n in kd)return vi[e]=t[n];return e}var Ed=jl("animationend"),jd=jl("animationiteration"),Cd=jl("animationstart"),Nd=jl("transitionend"),Rd=new Map,wu="abort auxClick cancel canPlay canPlayThrough click close contextMenu copy cut drag dragEnd dragEnter dragExit dragLeave dragOver dragStart drop durationChange emptied encrypted ended error gotPointerCapture input invalid keyDown keyPress keyUp load loadedData loadedMetadata loadStart lostPointerCapture mouseDown mouseMove mouseOut mouseOver mouseUp paste pause play playing pointerCancel pointerDown pointerMove pointerOut pointerOver pointerUp progress rateChange reset resize seeked seeking stalled submit suspend timeUpdate touchCancel touchEnd touchStart volumeChange scroll toggle touchMove waiting wheel".split(" ");function Zt(e,t){Rd.set(e,t),wn(t,[e])}for(var _i=0;_i<wu.length;_i++){var wi=wu[_i],Ph=wi.toLowerCase(),Lh=wi[0].toUpperCase()+wi.slice(1);Zt(Ph,"on"+Lh)}Zt(Ed,"onAnimationEnd");Zt(jd,"onAnimationIteration");Zt(Cd,"onAnimationStart");Zt("dblclick","onDoubleClick");Zt("focusin","onFocus");Zt("focusout","onBlur");Zt(Nd,"onTransitionEnd");Qn("onMouseEnter",["mouseout","mouseover"]);Qn("onMouseLeave",["mouseout","mouseover"]);Qn("onPointerEnter",["pointerout","pointerover"]);Qn("onPointerLeave",["pointerout","pointerover"]);wn("onChange","change click focusin focusout input keydown keyup selectionchange".split(" "));wn("onSelect","focusout contextmenu dragend focusin keydown keyup mousedown mouseup selectionchange".split(" "));wn("onBeforeInput",["compositionend","keypress","textInput","paste"]);wn("onCompositionEnd","compositionend focusout keydown keypress keyup mousedown".split(" "));wn("onCompositionStart","compositionstart focusout keydown keypress keyup mousedown".split(" "));wn("onCompositionUpdate","compositionupdate focusout keydown keypress keyup mousedown".split(" "));var Sr="abort canplay canplaythrough durationchange emptied encrypted ended error loadeddata loadedmetadata loadstart pause play playing progress ratechange resize seeked seeking stalled suspend timeupdate volumechange waiting".split(" "),Ih=new Set("cancel close invalid load scroll toggle".split(" ").concat(Sr));function xu(e,t,n){var r=e.type||"unknown-event";e.currentTarget=n,Pm(r,t,void 0,e),e.currentTarget=null}function Pd(e,t){t=(t&4)!==0;for(var n=0;n<e.length;n++){var r=e[n],o=r.event;r=r.listeners;e:{var l=void 0;if(t)for(var i=r.length-1;0<=i;i--){var a=r[i],u=a.instance,c=a.currentTarget;if(a=a.listener,u!==l&&o.isPropagationStopped())break e;xu(o,a,c),l=u}else for(i=0;i<r.length;i++){if(a=r[i],u=a.instance,c=a.currentTarget,a=a.listener,u!==l&&o.isPropagationStopped())break e;xu(o,a,c),l=u}}}if(Wo)throw e=ts,Wo=!1,ts=null,e}function ee(e,t){var n=t[ds];n===void 0&&(n=t[ds]=new Set);var r=e+"__bubble";n.has(r)||(Ld(t,e,2,!1),n.add(r))}function xi(e,t,n){var r=0;t&&(r|=4),Ld(n,e,r,t)}var vo="_reactListening"+Math.random().toString(36).slice(2);function Dr(e){if(!e[vo]){e[vo]=!0,zc.forEach(function(n){n!=="selectionchange"&&(Ih.has(n)||xi(n,!1,e),xi(n,!0,e))});var t=e.nodeType===9?e:e.ownerDocument;t===null||t[vo]||(t[vo]=!0,xi("selectionchange",!1,t))}}function Ld(e,t,n,r){switch(pd(t)){case 1:var o=Wm;break;case 4:o=Qm;break;default:o=Gs}n=o.bind(null,t,n,e),o=void 0,!es||t!=="touchstart"&&t!=="touchmove"&&t!=="wheel"||(o=!0),r?o!==void 0?e.addEventListener(t,n,{capture:!0,passive:o}):e.addEventListener(t,n,!0):o!==void 0?e.addEventListener(t,n,{passive:o}):e.addEventListener(t,n,!1)}function Si(e,t,n,r,o){var l=r;if(!(t&1)&&!(t&2)&&r!==null)e:for(;;){if(r===null)return;var i=r.tag;if(i===3||i===4){var a=r.stateNode.containerInfo;if(a===o||a.nodeType===8&&a.parentNode===o)break;if(i===4)for(i=r.return;i!==null;){var u=i.tag;if((u===3||u===4)&&(u=i.stateNode.containerInfo,u===o||u.nodeType===8&&u.parentNode===o))return;i=i.return}for(;a!==null;){if(i=an(a),i===null)return;if(u=i.tag,u===5||u===6){r=l=i;continue e}a=a.parentNode}}r=r.return}Zc(function(){var c=l,d=Ws(n),f=[];e:{var h=Rd.get(e);if(h!==void 0){var _=Xs,w=e;switch(e){case"keypress":if(To(n)===0)break e;case"keydown":case"keyup":_=sh;break;case"focusin":w="focus",_=hi;break;case"focusout":w="blur",_=hi;break;case"beforeblur":case"afterblur":_=hi;break;case"click":if(n.button===2)break e;case"auxclick":case"dblclick":case"mousedown":case"mousemove":case"mouseup":case"mouseout":case"mouseover":case"contextmenu":_=uu;break;case"drag":case"dragend":case"dragenter":case"dragexit":case"dragleave":case"dragover":case"dragstart":case"drop":_=Gm;break;case"touchcancel":case"touchend":case"touchmove":case"touchstart":_=ch;break;case Ed:case jd:case Cd:_=Jm;break;case Nd:_=fh;break;case"scroll":_=qm;break;case"wheel":_=mh;break;case"copy":case"cut":case"paste":_=eh;break;case"gotpointercapture":case"lostpointercapture":case"pointercancel":case"pointerdown":case"pointermove":case"pointerout":case"pointerover":case"pointerup":_=du}var v=(t&4)!==0,S=!v&&e==="scroll",p=v?h!==null?h+"Capture":null:h;v=[];for(var m=c,y;m!==null;){y=m;var x=y.stateNode;if(y.tag===5&&x!==null&&(y=x,p!==null&&(x=Mr(m,p),x!=null&&v.push(Ur(m,x,y)))),S)break;m=m.return}0<v.length&&(h=new _(h,w,null,n,d),f.push({event:h,listeners:v}))}}if(!(t&7)){e:{if(h=e==="mouseover"||e==="pointerover",_=e==="mouseout"||e==="pointerout",h&&n!==Ji&&(w=n.relatedTarget||n.fromElement)&&(an(w)||w[Lt]))break e;if((_||h)&&(h=d.window===d?d:(h=d.ownerDocument)?h.defaultView||h.parentWindow:window,_?(w=n.relatedTarget||n.toElement,_=c,w=w?an(w):null,w!==null&&(S=xn(w),w!==S||w.tag!==5&&w.tag!==6)&&(w=null)):(_=null,w=c),_!==w)){if(v=uu,x="onMouseLeave",p="onMouseEnter",m="mouse",(e==="pointerout"||e==="pointerover")&&(v=du,x="onPointerLeave",p="onPointerEnter",m="pointer"),S=_==null?h:Tn(_),y=w==null?h:Tn(w),h=new v(x,m+"leave",_,n,d),h.target=S,h.relatedTarget=y,x=null,an(d)===c&&(v=new v(p,m+"enter",w,n,d),v.target=y,v.relatedTarget=S,x=v),S=x,_&&w)t:{for(v=_,p=w,m=0,y=v;y;y=kn(y))m++;for(y=0,x=p;x;x=kn(x))y++;for(;0<m-y;)v=kn(v),m--;for(;0<y-m;)p=kn(p),y--;for(;m--;){if(v===p||p!==null&&v===p.alternate)break t;v=kn(v),p=kn(p)}v=null}else v=null;_!==null&&Su(f,h,_,v,!1),w!==null&&S!==null&&Su(f,S,w,v,!0)}}e:{if(h=c?Tn(c):window,_=h.nodeName&&h.nodeName.toLowerCase(),_==="select"||_==="input"&&h.type==="file")var k=xh;else if(mu(h))if(_d)k=jh;else{k=kh;var E=Sh}else(_=h.nodeName)&&_.toLowerCase()==="input"&&(h.type==="checkbox"||h.type==="radio")&&(k=Eh);if(k&&(k=k(e,c))){vd(f,k,n,d);break e}E&&E(e,h,c),e==="focusout"&&(E=h._wrapperState)&&E.controlled&&h.type==="number"&&qi(h,"number",h.value)}switch(E=c?Tn(c):window,e){case"focusin":(mu(E)||E.contentEditable==="true")&&(In=E,ls=c,Rr=null);break;case"focusout":Rr=ls=In=null;break;case"mousedown":is=!0;break;case"contextmenu":case"mouseup":case"dragend":is=!1,_u(f,n,d);break;case"selectionchange":if(Rh)break;case"keydown":case"keyup":_u(f,n,d)}var N;if(Zs)e:{switch(e){case"compositionstart":var C="onCompositionStart";break e;case"compositionend":C="onCompositionEnd";break e;case"compositionupdate":C="onCompositionUpdate";break e}C=void 0}else Ln?yd(e,n)&&(C="onCompositionEnd"):e==="keydown"&&n.keyCode===229&&(C="onCompositionStart");C&&(hd&&n.locale!=="ko"&&(Ln||C!=="onCompositionStart"?C==="onCompositionEnd"&&Ln&&(N=md()):(Ft=d,Ys="value"in Ft?Ft.value:Ft.textContent,Ln=!0)),E=Yo(c,C),0<E.length&&(C=new cu(C,e,null,n,d),f.push({event:C,listeners:E}),N?C.data=N:(N=gd(n),N!==null&&(C.data=N)))),(N=yh?gh(e,n):vh(e,n))&&(c=Yo(c,"onBeforeInput"),0<c.length&&(d=new cu("onBeforeInput","beforeinput",null,n,d),f.push({event:d,listeners:c}),d.data=N))}Pd(f,t)})}function Ur(e,t,n){return{instance:e,listener:t,currentTarget:n}}function Yo(e,t){for(var n=t+"Capture",r=[];e!==null;){var o=e,l=o.stateNode;o.tag===5&&l!==null&&(o=l,l=Mr(e,n),l!=null&&r.unshift(Ur(e,l,o)),l=Mr(e,t),l!=null&&r.push(Ur(e,l,o))),e=e.return}return r}function kn(e){if(e===null)return null;do e=e.return;while(e&&e.tag!==5);return e||null}function Su(e,t,n,r,o){for(var l=t._reactName,i=[];n!==null&&n!==r;){var a=n,u=a.alternate,c=a.stateNode;if(u!==null&&u===r)break;a.tag===5&&c!==null&&(a=c,o?(u=Mr(n,l),u!=null&&i.unshift(Ur(n,u,a))):o||(u=Mr(n,l),u!=null&&i.push(Ur(n,u,a)))),n=n.return}i.length!==0&&e.push({event:t,listeners:i})}var $h=/\r\n?/g,Th=/\u0000|\uFFFD/g;function ku(e){return(typeof e=="string"?e:""+e).replace($h,`
`).replace(Th,"")}function _o(e,t,n){if(t=ku(t),ku(e)!==t&&n)throw Error(j(425))}function Xo(){}var ss=null,as=null;function us(e,t){return e==="textarea"||e==="noscript"||typeof t.children=="string"||typeof t.children=="number"||typeof t.dangerouslySetInnerHTML=="object"&&t.dangerouslySetInnerHTML!==null&&t.dangerouslySetInnerHTML.__html!=null}var cs=typeof setTimeout=="function"?setTimeout:void 0,bh=typeof clearTimeout=="function"?clearTimeout:void 0,Eu=typeof Promise=="function"?Promise:void 0,Mh=typeof queueMicrotask=="function"?queueMicrotask:typeof Eu<"u"?function(e){return Eu.resolve(null).then(e).catch(Oh)}:cs;function Oh(e){setTimeout(function(){throw e})}function ki(e,t){var n=t,r=0;do{var o=n.nextSibling;if(e.removeChild(n),o&&o.nodeType===8)if(n=o.data,n==="/$"){if(r===0){e.removeChild(o),Ar(t);return}r--}else n!=="$"&&n!=="$?"&&n!=="$!"||r++;n=o}while(n);Ar(t)}function Wt(e){for(;e!=null;e=e.nextSibling){var t=e.nodeType;if(t===1||t===3)break;if(t===8){if(t=e.data,t==="$"||t==="$!"||t==="$?")break;if(t==="/$")return null}}return e}function ju(e){e=e.previousSibling;for(var t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="$"||n==="$!"||n==="$?"){if(t===0)return e;t--}else n==="/$"&&t++}e=e.previousSibling}return null}var nr=Math.random().toString(36).slice(2),vt="__reactFiber$"+nr,Hr="__reactProps$"+nr,Lt="__reactContainer$"+nr,ds="__reactEvents$"+nr,zh="__reactListeners$"+nr,Ah="__reactHandles$"+nr;function an(e){var t=e[vt];if(t)return t;for(var n=e.parentNode;n;){if(t=n[Lt]||n[vt]){if(n=t.alternate,t.child!==null||n!==null&&n.child!==null)for(e=ju(e);e!==null;){if(n=e[vt])return n;e=ju(e)}return t}e=n,n=e.parentNode}return null}function no(e){return e=e[vt]||e[Lt],!e||e.tag!==5&&e.tag!==6&&e.tag!==13&&e.tag!==3?null:e}function Tn(e){if(e.tag===5||e.tag===6)return e.stateNode;throw Error(j(33))}function Cl(e){return e[Hr]||null}var fs=[],bn=-1;function en(e){return{current:e}}function te(e){0>bn||(e.current=fs[bn],fs[bn]=null,bn--)}function J(e,t){bn++,fs[bn]=e.current,e.current=t}var Xt={},Ce=en(Xt),be=en(!1),hn=Xt;function qn(e,t){var n=e.type.contextTypes;if(!n)return Xt;var r=e.stateNode;if(r&&r.__reactInternalMemoizedUnmaskedChildContext===t)return r.__reactInternalMemoizedMaskedChildContext;var o={},l;for(l in n)o[l]=t[l];return r&&(e=e.stateNode,e.__reactInternalMemoizedUnmaskedChildContext=t,e.__reactInternalMemoizedMaskedChildContext=o),o}function Me(e){return e=e.childContextTypes,e!=null}function Jo(){te(be),te(Ce)}function Cu(e,t,n){if(Ce.current!==Xt)throw Error(j(168));J(Ce,t),J(be,n)}function Id(e,t,n){var r=e.stateNode;if(t=t.childContextTypes,typeof r.getChildContext!="function")return n;r=r.getChildContext();for(var o in r)if(!(o in t))throw Error(j(108,Sm(e)||"Unknown",o));return ie({},n,r)}function Zo(e){return e=(e=e.stateNode)&&e.__reactInternalMemoizedMergedChildContext||Xt,hn=Ce.current,J(Ce,e),J(be,be.current),!0}function Nu(e,t,n){var r=e.stateNode;if(!r)throw Error(j(169));n?(e=Id(e,t,hn),r.__reactInternalMemoizedMergedChildContext=e,te(be),te(Ce),J(Ce,e)):te(be),J(be,n)}var jt=null,Nl=!1,Ei=!1;function $d(e){jt===null?jt=[e]:jt.push(e)}function Bh(e){Nl=!0,$d(e)}function tn(){if(!Ei&&jt!==null){Ei=!0;var e=0,t=K;try{var n=jt;for(K=1;e<n.length;e++){var r=n[e];do r=r(!0);while(r!==null)}jt=null,Nl=!1}catch(o){throw jt!==null&&(jt=jt.slice(e+1)),rd(Qs,tn),o}finally{K=t,Ei=!1}}return null}var Mn=[],On=0,el=null,tl=0,Ke=[],Ge=0,yn=null,Ct=1,Nt="";function ln(e,t){Mn[On++]=tl,Mn[On++]=el,el=e,tl=t}function Td(e,t,n){Ke[Ge++]=Ct,Ke[Ge++]=Nt,Ke[Ge++]=yn,yn=e;var r=Ct;e=Nt;var o=32-ut(r)-1;r&=~(1<<o),n+=1;var l=32-ut(t)+o;if(30<l){var i=o-o%5;l=(r&(1<<i)-1).toString(32),r>>=i,o-=i,Ct=1<<32-ut(t)+o|n<<o|r,Nt=l+e}else Ct=1<<l|n<<o|r,Nt=e}function ta(e){e.return!==null&&(ln(e,1),Td(e,1,0))}function na(e){for(;e===el;)el=Mn[--On],Mn[On]=null,tl=Mn[--On],Mn[On]=null;for(;e===yn;)yn=Ke[--Ge],Ke[Ge]=null,Nt=Ke[--Ge],Ke[Ge]=null,Ct=Ke[--Ge],Ke[Ge]=null}var Ue=null,De=null,ne=!1,at=null;function bd(e,t){var n=Ye(5,null,null,0);n.elementType="DELETED",n.stateNode=t,n.return=e,t=e.deletions,t===null?(e.deletions=[n],e.flags|=16):t.push(n)}function Ru(e,t){switch(e.tag){case 5:var n=e.type;return t=t.nodeType!==1||n.toLowerCase()!==t.nodeName.toLowerCase()?null:t,t!==null?(e.stateNode=t,Ue=e,De=Wt(t.firstChild),!0):!1;case 6:return t=e.pendingProps===""||t.nodeType!==3?null:t,t!==null?(e.stateNode=t,Ue=e,De=null,!0):!1;case 13:return t=t.nodeType!==8?null:t,t!==null?(n=yn!==null?{id:Ct,overflow:Nt}:null,e.memoizedState={dehydrated:t,treeContext:n,retryLane:1073741824},n=Ye(18,null,null,0),n.stateNode=t,n.return=e,e.child=n,Ue=e,De=null,!0):!1;default:return!1}}function ps(e){return(e.mode&1)!==0&&(e.flags&128)===0}function ms(e){if(ne){var t=De;if(t){var n=t;if(!Ru(e,t)){if(ps(e))throw Error(j(418));t=Wt(n.nextSibling);var r=Ue;t&&Ru(e,t)?bd(r,n):(e.flags=e.flags&-4097|2,ne=!1,Ue=e)}}else{if(ps(e))throw Error(j(418));e.flags=e.flags&-4097|2,ne=!1,Ue=e}}}function Pu(e){for(e=e.return;e!==null&&e.tag!==5&&e.tag!==3&&e.tag!==13;)e=e.return;Ue=e}function wo(e){if(e!==Ue)return!1;if(!ne)return Pu(e),ne=!0,!1;var t;if((t=e.tag!==3)&&!(t=e.tag!==5)&&(t=e.type,t=t!=="head"&&t!=="body"&&!us(e.type,e.memoizedProps)),t&&(t=De)){if(ps(e))throw Md(),Error(j(418));for(;t;)bd(e,t),t=Wt(t.nextSibling)}if(Pu(e),e.tag===13){if(e=e.memoizedState,e=e!==null?e.dehydrated:null,!e)throw Error(j(317));e:{for(e=e.nextSibling,t=0;e;){if(e.nodeType===8){var n=e.data;if(n==="/$"){if(t===0){De=Wt(e.nextSibling);break e}t--}else n!=="$"&&n!=="$!"&&n!=="$?"||t++}e=e.nextSibling}De=null}}else De=Ue?Wt(e.stateNode.nextSibling):null;return!0}function Md(){for(var e=De;e;)e=Wt(e.nextSibling)}function Kn(){De=Ue=null,ne=!1}function ra(e){at===null?at=[e]:at.push(e)}var Fh=bt.ReactCurrentBatchConfig;function fr(e,t,n){if(e=n.ref,e!==null&&typeof e!="function"&&typeof e!="object"){if(n._owner){if(n=n._owner,n){if(n.tag!==1)throw Error(j(309));var r=n.stateNode}if(!r)throw Error(j(147,e));var o=r,l=""+e;return t!==null&&t.ref!==null&&typeof t.ref=="function"&&t.ref._stringRef===l?t.ref:(t=function(i){var a=o.refs;i===null?delete a[l]:a[l]=i},t._stringRef=l,t)}if(typeof e!="string")throw Error(j(284));if(!n._owner)throw Error(j(290,e))}return e}function xo(e,t){throw e=Object.prototype.toString.call(t),Error(j(31,e==="[object Object]"?"object with keys {"+Object.keys(t).join(", ")+"}":e))}function Lu(e){var t=e._init;return t(e._payload)}function Od(e){function t(p,m){if(e){var y=p.deletions;y===null?(p.deletions=[m],p.flags|=16):y.push(m)}}function n(p,m){if(!e)return null;for(;m!==null;)t(p,m),m=m.sibling;return null}function r(p,m){for(p=new Map;m!==null;)m.key!==null?p.set(m.key,m):p.set(m.index,m),m=m.sibling;return p}function o(p,m){return p=Gt(p,m),p.index=0,p.sibling=null,p}function l(p,m,y){return p.index=y,e?(y=p.alternate,y!==null?(y=y.index,y<m?(p.flags|=2,m):y):(p.flags|=2,m)):(p.flags|=1048576,m)}function i(p){return e&&p.alternate===null&&(p.flags|=2),p}function a(p,m,y,x){return m===null||m.tag!==6?(m=Ii(y,p.mode,x),m.return=p,m):(m=o(m,y),m.return=p,m)}function u(p,m,y,x){var k=y.type;return k===Pn?d(p,m,y.props.children,x,y.key):m!==null&&(m.elementType===k||typeof k=="object"&&k!==null&&k.$$typeof===Ot&&Lu(k)===m.type)?(x=o(m,y.props),x.ref=fr(p,m,y),x.return=p,x):(x=Fo(y.type,y.key,y.props,null,p.mode,x),x.ref=fr(p,m,y),x.return=p,x)}function c(p,m,y,x){return m===null||m.tag!==4||m.stateNode.containerInfo!==y.containerInfo||m.stateNode.implementation!==y.implementation?(m=$i(y,p.mode,x),m.return=p,m):(m=o(m,y.children||[]),m.return=p,m)}function d(p,m,y,x,k){return m===null||m.tag!==7?(m=mn(y,p.mode,x,k),m.return=p,m):(m=o(m,y),m.return=p,m)}function f(p,m,y){if(typeof m=="string"&&m!==""||typeof m=="number")return m=Ii(""+m,p.mode,y),m.return=p,m;if(typeof m=="object"&&m!==null){switch(m.$$typeof){case uo:return y=Fo(m.type,m.key,m.props,null,p.mode,y),y.ref=fr(p,null,m),y.return=p,y;case Rn:return m=$i(m,p.mode,y),m.return=p,m;case Ot:var x=m._init;return f(p,x(m._payload),y)}if(wr(m)||sr(m))return m=mn(m,p.mode,y,null),m.return=p,m;xo(p,m)}return null}function h(p,m,y,x){var k=m!==null?m.key:null;if(typeof y=="string"&&y!==""||typeof y=="number")return k!==null?null:a(p,m,""+y,x);if(typeof y=="object"&&y!==null){switch(y.$$typeof){case uo:return y.key===k?u(p,m,y,x):null;case Rn:return y.key===k?c(p,m,y,x):null;case Ot:return k=y._init,h(p,m,k(y._payload),x)}if(wr(y)||sr(y))return k!==null?null:d(p,m,y,x,null);xo(p,y)}return null}function _(p,m,y,x,k){if(typeof x=="string"&&x!==""||typeof x=="number")return p=p.get(y)||null,a(m,p,""+x,k);if(typeof x=="object"&&x!==null){switch(x.$$typeof){case uo:return p=p.get(x.key===null?y:x.key)||null,u(m,p,x,k);case Rn:return p=p.get(x.key===null?y:x.key)||null,c(m,p,x,k);case Ot:var E=x._init;return _(p,m,y,E(x._payload),k)}if(wr(x)||sr(x))return p=p.get(y)||null,d(m,p,x,k,null);xo(m,x)}return null}function w(p,m,y,x){for(var k=null,E=null,N=m,C=m=0,z=null;N!==null&&C<y.length;C++){N.index>C?(z=N,N=null):z=N.sibling;var I=h(p,N,y[C],x);if(I===null){N===null&&(N=z);break}e&&N&&I.alternate===null&&t(p,N),m=l(I,m,C),E===null?k=I:E.sibling=I,E=I,N=z}if(C===y.length)return n(p,N),ne&&ln(p,C),k;if(N===null){for(;C<y.length;C++)N=f(p,y[C],x),N!==null&&(m=l(N,m,C),E===null?k=N:E.sibling=N,E=N);return ne&&ln(p,C),k}for(N=r(p,N);C<y.length;C++)z=_(N,p,C,y[C],x),z!==null&&(e&&z.alternate!==null&&N.delete(z.key===null?C:z.key),m=l(z,m,C),E===null?k=z:E.sibling=z,E=z);return e&&N.forEach(function(A){return t(p,A)}),ne&&ln(p,C),k}function v(p,m,y,x){var k=sr(y);if(typeof k!="function")throw Error(j(150));if(y=k.call(y),y==null)throw Error(j(151));for(var E=k=null,N=m,C=m=0,z=null,I=y.next();N!==null&&!I.done;C++,I=y.next()){N.index>C?(z=N,N=null):z=N.sibling;var A=h(p,N,I.value,x);if(A===null){N===null&&(N=z);break}e&&N&&A.alternate===null&&t(p,N),m=l(A,m,C),E===null?k=A:E.sibling=A,E=A,N=z}if(I.done)return n(p,N),ne&&ln(p,C),k;if(N===null){for(;!I.done;C++,I=y.next())I=f(p,I.value,x),I!==null&&(m=l(I,m,C),E===null?k=I:E.sibling=I,E=I);return ne&&ln(p,C),k}for(N=r(p,N);!I.done;C++,I=y.next())I=_(N,p,C,I.value,x),I!==null&&(e&&I.alternate!==null&&N.delete(I.key===null?C:I.key),m=l(I,m,C),E===null?k=I:E.sibling=I,E=I);return e&&N.forEach(function(Z){return t(p,Z)}),ne&&ln(p,C),k}function S(p,m,y,x){if(typeof y=="object"&&y!==null&&y.type===Pn&&y.key===null&&(y=y.props.children),typeof y=="object"&&y!==null){switch(y.$$typeof){case uo:e:{for(var k=y.key,E=m;E!==null;){if(E.key===k){if(k=y.type,k===Pn){if(E.tag===7){n(p,E.sibling),m=o(E,y.props.children),m.return=p,p=m;break e}}else if(E.elementType===k||typeof k=="object"&&k!==null&&k.$$typeof===Ot&&Lu(k)===E.type){n(p,E.sibling),m=o(E,y.props),m.ref=fr(p,E,y),m.return=p,p=m;break e}n(p,E);break}else t(p,E);E=E.sibling}y.type===Pn?(m=mn(y.props.children,p.mode,x,y.key),m.return=p,p=m):(x=Fo(y.type,y.key,y.props,null,p.mode,x),x.ref=fr(p,m,y),x.return=p,p=x)}return i(p);case Rn:e:{for(E=y.key;m!==null;){if(m.key===E)if(m.tag===4&&m.stateNode.containerInfo===y.containerInfo&&m.stateNode.implementation===y.implementation){n(p,m.sibling),m=o(m,y.children||[]),m.return=p,p=m;break e}else{n(p,m);break}else t(p,m);m=m.sibling}m=$i(y,p.mode,x),m.return=p,p=m}return i(p);case Ot:return E=y._init,S(p,m,E(y._payload),x)}if(wr(y))return w(p,m,y,x);if(sr(y))return v(p,m,y,x);xo(p,y)}return typeof y=="string"&&y!==""||typeof y=="number"?(y=""+y,m!==null&&m.tag===6?(n(p,m.sibling),m=o(m,y),m.return=p,p=m):(n(p,m),m=Ii(y,p.mode,x),m.return=p,p=m),i(p)):n(p,m)}return S}var Gn=Od(!0),zd=Od(!1),nl=en(null),rl=null,zn=null,oa=null;function la(){oa=zn=rl=null}function ia(e){var t=nl.current;te(nl),e._currentValue=t}function hs(e,t,n){for(;e!==null;){var r=e.alternate;if((e.childLanes&t)!==t?(e.childLanes|=t,r!==null&&(r.childLanes|=t)):r!==null&&(r.childLanes&t)!==t&&(r.childLanes|=t),e===n)break;e=e.return}}function Vn(e,t){rl=e,oa=zn=null,e=e.dependencies,e!==null&&e.firstContext!==null&&(e.lanes&t&&(Te=!0),e.firstContext=null)}function Je(e){var t=e._currentValue;if(oa!==e)if(e={context:e,memoizedValue:t,next:null},zn===null){if(rl===null)throw Error(j(308));zn=e,rl.dependencies={lanes:0,firstContext:e}}else zn=zn.next=e;return t}var un=null;function sa(e){un===null?un=[e]:un.push(e)}function Ad(e,t,n,r){var o=t.interleaved;return o===null?(n.next=n,sa(t)):(n.next=o.next,o.next=n),t.interleaved=n,It(e,r)}function It(e,t){e.lanes|=t;var n=e.alternate;for(n!==null&&(n.lanes|=t),n=e,e=e.return;e!==null;)e.childLanes|=t,n=e.alternate,n!==null&&(n.childLanes|=t),n=e,e=e.return;return n.tag===3?n.stateNode:null}var zt=!1;function aa(e){e.updateQueue={baseState:e.memoizedState,firstBaseUpdate:null,lastBaseUpdate:null,shared:{pending:null,interleaved:null,lanes:0},effects:null}}function Bd(e,t){e=e.updateQueue,t.updateQueue===e&&(t.updateQueue={baseState:e.baseState,firstBaseUpdate:e.firstBaseUpdate,lastBaseUpdate:e.lastBaseUpdate,shared:e.shared,effects:e.effects})}function Rt(e,t){return{eventTime:e,lane:t,tag:0,payload:null,callback:null,next:null}}function Qt(e,t,n){var r=e.updateQueue;if(r===null)return null;if(r=r.shared,V&2){var o=r.pending;return o===null?t.next=t:(t.next=o.next,o.next=t),r.pending=t,It(e,n)}return o=r.interleaved,o===null?(t.next=t,sa(r)):(t.next=o.next,o.next=t),r.interleaved=t,It(e,n)}function bo(e,t,n){if(t=t.updateQueue,t!==null&&(t=t.shared,(n&4194240)!==0)){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,qs(e,n)}}function Iu(e,t){var n=e.updateQueue,r=e.alternate;if(r!==null&&(r=r.updateQueue,n===r)){var o=null,l=null;if(n=n.firstBaseUpdate,n!==null){do{var i={eventTime:n.eventTime,lane:n.lane,tag:n.tag,payload:n.payload,callback:n.callback,next:null};l===null?o=l=i:l=l.next=i,n=n.next}while(n!==null);l===null?o=l=t:l=l.next=t}else o=l=t;n={baseState:r.baseState,firstBaseUpdate:o,lastBaseUpdate:l,shared:r.shared,effects:r.effects},e.updateQueue=n;return}e=n.lastBaseUpdate,e===null?n.firstBaseUpdate=t:e.next=t,n.lastBaseUpdate=t}function ol(e,t,n,r){var o=e.updateQueue;zt=!1;var l=o.firstBaseUpdate,i=o.lastBaseUpdate,a=o.shared.pending;if(a!==null){o.shared.pending=null;var u=a,c=u.next;u.next=null,i===null?l=c:i.next=c,i=u;var d=e.alternate;d!==null&&(d=d.updateQueue,a=d.lastBaseUpdate,a!==i&&(a===null?d.firstBaseUpdate=c:a.next=c,d.lastBaseUpdate=u))}if(l!==null){var f=o.baseState;i=0,d=c=u=null,a=l;do{var h=a.lane,_=a.eventTime;if((r&h)===h){d!==null&&(d=d.next={eventTime:_,lane:0,tag:a.tag,payload:a.payload,callback:a.callback,next:null});e:{var w=e,v=a;switch(h=t,_=n,v.tag){case 1:if(w=v.payload,typeof w=="function"){f=w.call(_,f,h);break e}f=w;break e;case 3:w.flags=w.flags&-65537|128;case 0:if(w=v.payload,h=typeof w=="function"?w.call(_,f,h):w,h==null)break e;f=ie({},f,h);break e;case 2:zt=!0}}a.callback!==null&&a.lane!==0&&(e.flags|=64,h=o.effects,h===null?o.effects=[a]:h.push(a))}else _={eventTime:_,lane:h,tag:a.tag,payload:a.payload,callback:a.callback,next:null},d===null?(c=d=_,u=f):d=d.next=_,i|=h;if(a=a.next,a===null){if(a=o.shared.pending,a===null)break;h=a,a=h.next,h.next=null,o.lastBaseUpdate=h,o.shared.pending=null}}while(!0);if(d===null&&(u=f),o.baseState=u,o.firstBaseUpdate=c,o.lastBaseUpdate=d,t=o.shared.interleaved,t!==null){o=t;do i|=o.lane,o=o.next;while(o!==t)}else l===null&&(o.shared.lanes=0);vn|=i,e.lanes=i,e.memoizedState=f}}function $u(e,t,n){if(e=t.effects,t.effects=null,e!==null)for(t=0;t<e.length;t++){var r=e[t],o=r.callback;if(o!==null){if(r.callback=null,r=n,typeof o!="function")throw Error(j(191,o));o.call(r)}}}var ro={},wt=en(ro),Vr=en(ro),Wr=en(ro);function cn(e){if(e===ro)throw Error(j(174));return e}function ua(e,t){switch(J(Wr,t),J(Vr,e),J(wt,ro),e=t.nodeType,e){case 9:case 11:t=(t=t.documentElement)?t.namespaceURI:Gi(null,"");break;default:e=e===8?t.parentNode:t,t=e.namespaceURI||null,e=e.tagName,t=Gi(t,e)}te(wt),J(wt,t)}function Yn(){te(wt),te(Vr),te(Wr)}function Fd(e){cn(Wr.current);var t=cn(wt.current),n=Gi(t,e.type);t!==n&&(J(Vr,e),J(wt,n))}function ca(e){Vr.current===e&&(te(wt),te(Vr))}var re=en(0);function ll(e){for(var t=e;t!==null;){if(t.tag===13){var n=t.memoizedState;if(n!==null&&(n=n.dehydrated,n===null||n.data==="$?"||n.data==="$!"))return t}else if(t.tag===19&&t.memoizedProps.revealOrder!==void 0){if(t.flags&128)return t}else if(t.child!==null){t.child.return=t,t=t.child;continue}if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return null;t=t.return}t.sibling.return=t.return,t=t.sibling}return null}var ji=[];function da(){for(var e=0;e<ji.length;e++)ji[e]._workInProgressVersionPrimary=null;ji.length=0}var Mo=bt.ReactCurrentDispatcher,Ci=bt.ReactCurrentBatchConfig,gn=0,oe=null,pe=null,he=null,il=!1,Pr=!1,Qr=0,Dh=0;function xe(){throw Error(j(321))}function fa(e,t){if(t===null)return!1;for(var n=0;n<t.length&&n<e.length;n++)if(!ft(e[n],t[n]))return!1;return!0}function pa(e,t,n,r,o,l){if(gn=l,oe=t,t.memoizedState=null,t.updateQueue=null,t.lanes=0,Mo.current=e===null||e.memoizedState===null?Wh:Qh,e=n(r,o),Pr){l=0;do{if(Pr=!1,Qr=0,25<=l)throw Error(j(301));l+=1,he=pe=null,t.updateQueue=null,Mo.current=qh,e=n(r,o)}while(Pr)}if(Mo.current=sl,t=pe!==null&&pe.next!==null,gn=0,he=pe=oe=null,il=!1,t)throw Error(j(300));return e}function ma(){var e=Qr!==0;return Qr=0,e}function gt(){var e={memoizedState:null,baseState:null,baseQueue:null,queue:null,next:null};return he===null?oe.memoizedState=he=e:he=he.next=e,he}function Ze(){if(pe===null){var e=oe.alternate;e=e!==null?e.memoizedState:null}else e=pe.next;var t=he===null?oe.memoizedState:he.next;if(t!==null)he=t,pe=e;else{if(e===null)throw Error(j(310));pe=e,e={memoizedState:pe.memoizedState,baseState:pe.baseState,baseQueue:pe.baseQueue,queue:pe.queue,next:null},he===null?oe.memoizedState=he=e:he=he.next=e}return he}function qr(e,t){return typeof t=="function"?t(e):t}function Ni(e){var t=Ze(),n=t.queue;if(n===null)throw Error(j(311));n.lastRenderedReducer=e;var r=pe,o=r.baseQueue,l=n.pending;if(l!==null){if(o!==null){var i=o.next;o.next=l.next,l.next=i}r.baseQueue=o=l,n.pending=null}if(o!==null){l=o.next,r=r.baseState;var a=i=null,u=null,c=l;do{var d=c.lane;if((gn&d)===d)u!==null&&(u=u.next={lane:0,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null}),r=c.hasEagerState?c.eagerState:e(r,c.action);else{var f={lane:d,action:c.action,hasEagerState:c.hasEagerState,eagerState:c.eagerState,next:null};u===null?(a=u=f,i=r):u=u.next=f,oe.lanes|=d,vn|=d}c=c.next}while(c!==null&&c!==l);u===null?i=r:u.next=a,ft(r,t.memoizedState)||(Te=!0),t.memoizedState=r,t.baseState=i,t.baseQueue=u,n.lastRenderedState=r}if(e=n.interleaved,e!==null){o=e;do l=o.lane,oe.lanes|=l,vn|=l,o=o.next;while(o!==e)}else o===null&&(n.lanes=0);return[t.memoizedState,n.dispatch]}function Ri(e){var t=Ze(),n=t.queue;if(n===null)throw Error(j(311));n.lastRenderedReducer=e;var r=n.dispatch,o=n.pending,l=t.memoizedState;if(o!==null){n.pending=null;var i=o=o.next;do l=e(l,i.action),i=i.next;while(i!==o);ft(l,t.memoizedState)||(Te=!0),t.memoizedState=l,t.baseQueue===null&&(t.baseState=l),n.lastRenderedState=l}return[l,r]}function Dd(){}function Ud(e,t){var n=oe,r=Ze(),o=t(),l=!ft(r.memoizedState,o);if(l&&(r.memoizedState=o,Te=!0),r=r.queue,ha(Wd.bind(null,n,r,e),[e]),r.getSnapshot!==t||l||he!==null&&he.memoizedState.tag&1){if(n.flags|=2048,Kr(9,Vd.bind(null,n,r,o,t),void 0,null),ye===null)throw Error(j(349));gn&30||Hd(n,t,o)}return o}function Hd(e,t,n){e.flags|=16384,e={getSnapshot:t,value:n},t=oe.updateQueue,t===null?(t={lastEffect:null,stores:null},oe.updateQueue=t,t.stores=[e]):(n=t.stores,n===null?t.stores=[e]:n.push(e))}function Vd(e,t,n,r){t.value=n,t.getSnapshot=r,Qd(t)&&qd(e)}function Wd(e,t,n){return n(function(){Qd(t)&&qd(e)})}function Qd(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!ft(e,n)}catch{return!0}}function qd(e){var t=It(e,1);t!==null&&ct(t,e,1,-1)}function Tu(e){var t=gt();return typeof e=="function"&&(e=e()),t.memoizedState=t.baseState=e,e={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:qr,lastRenderedState:e},t.queue=e,e=e.dispatch=Vh.bind(null,oe,e),[t.memoizedState,e]}function Kr(e,t,n,r){return e={tag:e,create:t,destroy:n,deps:r,next:null},t=oe.updateQueue,t===null?(t={lastEffect:null,stores:null},oe.updateQueue=t,t.lastEffect=e.next=e):(n=t.lastEffect,n===null?t.lastEffect=e.next=e:(r=n.next,n.next=e,e.next=r,t.lastEffect=e)),e}function Kd(){return Ze().memoizedState}function Oo(e,t,n,r){var o=gt();oe.flags|=e,o.memoizedState=Kr(1|t,n,void 0,r===void 0?null:r)}function Rl(e,t,n,r){var o=Ze();r=r===void 0?null:r;var l=void 0;if(pe!==null){var i=pe.memoizedState;if(l=i.destroy,r!==null&&fa(r,i.deps)){o.memoizedState=Kr(t,n,l,r);return}}oe.flags|=e,o.memoizedState=Kr(1|t,n,l,r)}function bu(e,t){return Oo(8390656,8,e,t)}function ha(e,t){return Rl(2048,8,e,t)}function Gd(e,t){return Rl(4,2,e,t)}function Yd(e,t){return Rl(4,4,e,t)}function Xd(e,t){if(typeof t=="function")return e=e(),t(e),function(){t(null)};if(t!=null)return e=e(),t.current=e,function(){t.current=null}}function Jd(e,t,n){return n=n!=null?n.concat([e]):null,Rl(4,4,Xd.bind(null,t,e),n)}function ya(){}function Zd(e,t){var n=Ze();t=t===void 0?null:t;var r=n.memoizedState;return r!==null&&t!==null&&fa(t,r[1])?r[0]:(n.memoizedState=[e,t],e)}function ef(e,t){var n=Ze();t=t===void 0?null:t;var r=n.memoizedState;return r!==null&&t!==null&&fa(t,r[1])?r[0]:(e=e(),n.memoizedState=[e,t],e)}function tf(e,t,n){return gn&21?(ft(n,t)||(n=id(),oe.lanes|=n,vn|=n,e.baseState=!0),t):(e.baseState&&(e.baseState=!1,Te=!0),e.memoizedState=n)}function Uh(e,t){var n=K;K=n!==0&&4>n?n:4,e(!0);var r=Ci.transition;Ci.transition={};try{e(!1),t()}finally{K=n,Ci.transition=r}}function nf(){return Ze().memoizedState}function Hh(e,t,n){var r=Kt(e);if(n={lane:r,action:n,hasEagerState:!1,eagerState:null,next:null},rf(e))of(t,n);else if(n=Ad(e,t,n,r),n!==null){var o=Re();ct(n,e,r,o),lf(n,t,r)}}function Vh(e,t,n){var r=Kt(e),o={lane:r,action:n,hasEagerState:!1,eagerState:null,next:null};if(rf(e))of(t,o);else{var l=e.alternate;if(e.lanes===0&&(l===null||l.lanes===0)&&(l=t.lastRenderedReducer,l!==null))try{var i=t.lastRenderedState,a=l(i,n);if(o.hasEagerState=!0,o.eagerState=a,ft(a,i)){var u=t.interleaved;u===null?(o.next=o,sa(t)):(o.next=u.next,u.next=o),t.interleaved=o;return}}catch{}finally{}n=Ad(e,t,o,r),n!==null&&(o=Re(),ct(n,e,r,o),lf(n,t,r))}}function rf(e){var t=e.alternate;return e===oe||t!==null&&t===oe}function of(e,t){Pr=il=!0;var n=e.pending;n===null?t.next=t:(t.next=n.next,n.next=t),e.pending=t}function lf(e,t,n){if(n&4194240){var r=t.lanes;r&=e.pendingLanes,n|=r,t.lanes=n,qs(e,n)}}var sl={readContext:Je,useCallback:xe,useContext:xe,useEffect:xe,useImperativeHandle:xe,useInsertionEffect:xe,useLayoutEffect:xe,useMemo:xe,useReducer:xe,useRef:xe,useState:xe,useDebugValue:xe,useDeferredValue:xe,useTransition:xe,useMutableSource:xe,useSyncExternalStore:xe,useId:xe,unstable_isNewReconciler:!1},Wh={readContext:Je,useCallback:function(e,t){return gt().memoizedState=[e,t===void 0?null:t],e},useContext:Je,useEffect:bu,useImperativeHandle:function(e,t,n){return n=n!=null?n.concat([e]):null,Oo(4194308,4,Xd.bind(null,t,e),n)},useLayoutEffect:function(e,t){return Oo(4194308,4,e,t)},useInsertionEffect:function(e,t){return Oo(4,2,e,t)},useMemo:function(e,t){var n=gt();return t=t===void 0?null:t,e=e(),n.memoizedState=[e,t],e},useReducer:function(e,t,n){var r=gt();return t=n!==void 0?n(t):t,r.memoizedState=r.baseState=t,e={pending:null,interleaved:null,lanes:0,dispatch:null,lastRenderedReducer:e,lastRenderedState:t},r.queue=e,e=e.dispatch=Hh.bind(null,oe,e),[r.memoizedState,e]},useRef:function(e){var t=gt();return e={current:e},t.memoizedState=e},useState:Tu,useDebugValue:ya,useDeferredValue:function(e){return gt().memoizedState=e},useTransition:function(){var e=Tu(!1),t=e[0];return e=Uh.bind(null,e[1]),gt().memoizedState=e,[t,e]},useMutableSource:function(){},useSyncExternalStore:function(e,t,n){var r=oe,o=gt();if(ne){if(n===void 0)throw Error(j(407));n=n()}else{if(n=t(),ye===null)throw Error(j(349));gn&30||Hd(r,t,n)}o.memoizedState=n;var l={value:n,getSnapshot:t};return o.queue=l,bu(Wd.bind(null,r,l,e),[e]),r.flags|=2048,Kr(9,Vd.bind(null,r,l,n,t),void 0,null),n},useId:function(){var e=gt(),t=ye.identifierPrefix;if(ne){var n=Nt,r=Ct;n=(r&~(1<<32-ut(r)-1)).toString(32)+n,t=":"+t+"R"+n,n=Qr++,0<n&&(t+="H"+n.toString(32)),t+=":"}else n=Dh++,t=":"+t+"r"+n.toString(32)+":";return e.memoizedState=t},unstable_isNewReconciler:!1},Qh={readContext:Je,useCallback:Zd,useContext:Je,useEffect:ha,useImperativeHandle:Jd,useInsertionEffect:Gd,useLayoutEffect:Yd,useMemo:ef,useReducer:Ni,useRef:Kd,useState:function(){return Ni(qr)},useDebugValue:ya,useDeferredValue:function(e){var t=Ze();return tf(t,pe.memoizedState,e)},useTransition:function(){var e=Ni(qr)[0],t=Ze().memoizedState;return[e,t]},useMutableSource:Dd,useSyncExternalStore:Ud,useId:nf,unstable_isNewReconciler:!1},qh={readContext:Je,useCallback:Zd,useContext:Je,useEffect:ha,useImperativeHandle:Jd,useInsertionEffect:Gd,useLayoutEffect:Yd,useMemo:ef,useReducer:Ri,useRef:Kd,useState:function(){return Ri(qr)},useDebugValue:ya,useDeferredValue:function(e){var t=Ze();return pe===null?t.memoizedState=e:tf(t,pe.memoizedState,e)},useTransition:function(){var e=Ri(qr)[0],t=Ze().memoizedState;return[e,t]},useMutableSource:Dd,useSyncExternalStore:Ud,useId:nf,unstable_isNewReconciler:!1};function it(e,t){if(e&&e.defaultProps){t=ie({},t),e=e.defaultProps;for(var n in e)t[n]===void 0&&(t[n]=e[n]);return t}return t}function ys(e,t,n,r){t=e.memoizedState,n=n(r,t),n=n==null?t:ie({},t,n),e.memoizedState=n,e.lanes===0&&(e.updateQueue.baseState=n)}var Pl={isMounted:function(e){return(e=e._reactInternals)?xn(e)===e:!1},enqueueSetState:function(e,t,n){e=e._reactInternals;var r=Re(),o=Kt(e),l=Rt(r,o);l.payload=t,n!=null&&(l.callback=n),t=Qt(e,l,o),t!==null&&(ct(t,e,o,r),bo(t,e,o))},enqueueReplaceState:function(e,t,n){e=e._reactInternals;var r=Re(),o=Kt(e),l=Rt(r,o);l.tag=1,l.payload=t,n!=null&&(l.callback=n),t=Qt(e,l,o),t!==null&&(ct(t,e,o,r),bo(t,e,o))},enqueueForceUpdate:function(e,t){e=e._reactInternals;var n=Re(),r=Kt(e),o=Rt(n,r);o.tag=2,t!=null&&(o.callback=t),t=Qt(e,o,r),t!==null&&(ct(t,e,r,n),bo(t,e,r))}};function Mu(e,t,n,r,o,l,i){return e=e.stateNode,typeof e.shouldComponentUpdate=="function"?e.shouldComponentUpdate(r,l,i):t.prototype&&t.prototype.isPureReactComponent?!Fr(n,r)||!Fr(o,l):!0}function sf(e,t,n){var r=!1,o=Xt,l=t.contextType;return typeof l=="object"&&l!==null?l=Je(l):(o=Me(t)?hn:Ce.current,r=t.contextTypes,l=(r=r!=null)?qn(e,o):Xt),t=new t(n,l),e.memoizedState=t.state!==null&&t.state!==void 0?t.state:null,t.updater=Pl,e.stateNode=t,t._reactInternals=e,r&&(e=e.stateNode,e.__reactInternalMemoizedUnmaskedChildContext=o,e.__reactInternalMemoizedMaskedChildContext=l),t}function Ou(e,t,n,r){e=t.state,typeof t.componentWillReceiveProps=="function"&&t.componentWillReceiveProps(n,r),typeof t.UNSAFE_componentWillReceiveProps=="function"&&t.UNSAFE_componentWillReceiveProps(n,r),t.state!==e&&Pl.enqueueReplaceState(t,t.state,null)}function gs(e,t,n,r){var o=e.stateNode;o.props=n,o.state=e.memoizedState,o.refs={},aa(e);var l=t.contextType;typeof l=="object"&&l!==null?o.context=Je(l):(l=Me(t)?hn:Ce.current,o.context=qn(e,l)),o.state=e.memoizedState,l=t.getDerivedStateFromProps,typeof l=="function"&&(ys(e,t,l,n),o.state=e.memoizedState),typeof t.getDerivedStateFromProps=="function"||typeof o.getSnapshotBeforeUpdate=="function"||typeof o.UNSAFE_componentWillMount!="function"&&typeof o.componentWillMount!="function"||(t=o.state,typeof o.componentWillMount=="function"&&o.componentWillMount(),typeof o.UNSAFE_componentWillMount=="function"&&o.UNSAFE_componentWillMount(),t!==o.state&&Pl.enqueueReplaceState(o,o.state,null),ol(e,n,o,r),o.state=e.memoizedState),typeof o.componentDidMount=="function"&&(e.flags|=4194308)}function Xn(e,t){try{var n="",r=t;do n+=xm(r),r=r.return;while(r);var o=n}catch(l){o=`
Error generating stack: `+l.message+`
`+l.stack}return{value:e,source:t,stack:o,digest:null}}function Pi(e,t,n){return{value:e,source:null,stack:n??null,digest:t??null}}function vs(e,t){try{console.error(t.value)}catch(n){setTimeout(function(){throw n})}}var Kh=typeof WeakMap=="function"?WeakMap:Map;function af(e,t,n){n=Rt(-1,n),n.tag=3,n.payload={element:null};var r=t.value;return n.callback=function(){ul||(ul=!0,Rs=r),vs(e,t)},n}function uf(e,t,n){n=Rt(-1,n),n.tag=3;var r=e.type.getDerivedStateFromError;if(typeof r=="function"){var o=t.value;n.payload=function(){return r(o)},n.callback=function(){vs(e,t)}}var l=e.stateNode;return l!==null&&typeof l.componentDidCatch=="function"&&(n.callback=function(){vs(e,t),typeof r!="function"&&(qt===null?qt=new Set([this]):qt.add(this));var i=t.stack;this.componentDidCatch(t.value,{componentStack:i!==null?i:""})}),n}function zu(e,t,n){var r=e.pingCache;if(r===null){r=e.pingCache=new Kh;var o=new Set;r.set(t,o)}else o=r.get(t),o===void 0&&(o=new Set,r.set(t,o));o.has(n)||(o.add(n),e=ay.bind(null,e,t,n),t.then(e,e))}function Au(e){do{var t;if((t=e.tag===13)&&(t=e.memoizedState,t=t!==null?t.dehydrated!==null:!0),t)return e;e=e.return}while(e!==null);return null}function Bu(e,t,n,r,o){return e.mode&1?(e.flags|=65536,e.lanes=o,e):(e===t?e.flags|=65536:(e.flags|=128,n.flags|=131072,n.flags&=-52805,n.tag===1&&(n.alternate===null?n.tag=17:(t=Rt(-1,1),t.tag=2,Qt(n,t,1))),n.lanes|=1),e)}var Gh=bt.ReactCurrentOwner,Te=!1;function Ne(e,t,n,r){t.child=e===null?zd(t,null,n,r):Gn(t,e.child,n,r)}function Fu(e,t,n,r,o){n=n.render;var l=t.ref;return Vn(t,o),r=pa(e,t,n,r,l,o),n=ma(),e!==null&&!Te?(t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~o,$t(e,t,o)):(ne&&n&&ta(t),t.flags|=1,Ne(e,t,r,o),t.child)}function Du(e,t,n,r,o){if(e===null){var l=n.type;return typeof l=="function"&&!Ea(l)&&l.defaultProps===void 0&&n.compare===null&&n.defaultProps===void 0?(t.tag=15,t.type=l,cf(e,t,l,r,o)):(e=Fo(n.type,null,r,t,t.mode,o),e.ref=t.ref,e.return=t,t.child=e)}if(l=e.child,!(e.lanes&o)){var i=l.memoizedProps;if(n=n.compare,n=n!==null?n:Fr,n(i,r)&&e.ref===t.ref)return $t(e,t,o)}return t.flags|=1,e=Gt(l,r),e.ref=t.ref,e.return=t,t.child=e}function cf(e,t,n,r,o){if(e!==null){var l=e.memoizedProps;if(Fr(l,r)&&e.ref===t.ref)if(Te=!1,t.pendingProps=r=l,(e.lanes&o)!==0)e.flags&131072&&(Te=!0);else return t.lanes=e.lanes,$t(e,t,o)}return _s(e,t,n,r,o)}function df(e,t,n){var r=t.pendingProps,o=r.children,l=e!==null?e.memoizedState:null;if(r.mode==="hidden")if(!(t.mode&1))t.memoizedState={baseLanes:0,cachePool:null,transitions:null},J(Bn,Fe),Fe|=n;else{if(!(n&1073741824))return e=l!==null?l.baseLanes|n:n,t.lanes=t.childLanes=1073741824,t.memoizedState={baseLanes:e,cachePool:null,transitions:null},t.updateQueue=null,J(Bn,Fe),Fe|=e,null;t.memoizedState={baseLanes:0,cachePool:null,transitions:null},r=l!==null?l.baseLanes:n,J(Bn,Fe),Fe|=r}else l!==null?(r=l.baseLanes|n,t.memoizedState=null):r=n,J(Bn,Fe),Fe|=r;return Ne(e,t,o,n),t.child}function ff(e,t){var n=t.ref;(e===null&&n!==null||e!==null&&e.ref!==n)&&(t.flags|=512,t.flags|=2097152)}function _s(e,t,n,r,o){var l=Me(n)?hn:Ce.current;return l=qn(t,l),Vn(t,o),n=pa(e,t,n,r,l,o),r=ma(),e!==null&&!Te?(t.updateQueue=e.updateQueue,t.flags&=-2053,e.lanes&=~o,$t(e,t,o)):(ne&&r&&ta(t),t.flags|=1,Ne(e,t,n,o),t.child)}function Uu(e,t,n,r,o){if(Me(n)){var l=!0;Zo(t)}else l=!1;if(Vn(t,o),t.stateNode===null)zo(e,t),sf(t,n,r),gs(t,n,r,o),r=!0;else if(e===null){var i=t.stateNode,a=t.memoizedProps;i.props=a;var u=i.context,c=n.contextType;typeof c=="object"&&c!==null?c=Je(c):(c=Me(n)?hn:Ce.current,c=qn(t,c));var d=n.getDerivedStateFromProps,f=typeof d=="function"||typeof i.getSnapshotBeforeUpdate=="function";f||typeof i.UNSAFE_componentWillReceiveProps!="function"&&typeof i.componentWillReceiveProps!="function"||(a!==r||u!==c)&&Ou(t,i,r,c),zt=!1;var h=t.memoizedState;i.state=h,ol(t,r,i,o),u=t.memoizedState,a!==r||h!==u||be.current||zt?(typeof d=="function"&&(ys(t,n,d,r),u=t.memoizedState),(a=zt||Mu(t,n,a,r,h,u,c))?(f||typeof i.UNSAFE_componentWillMount!="function"&&typeof i.componentWillMount!="function"||(typeof i.componentWillMount=="function"&&i.componentWillMount(),typeof i.UNSAFE_componentWillMount=="function"&&i.UNSAFE_componentWillMount()),typeof i.componentDidMount=="function"&&(t.flags|=4194308)):(typeof i.componentDidMount=="function"&&(t.flags|=4194308),t.memoizedProps=r,t.memoizedState=u),i.props=r,i.state=u,i.context=c,r=a):(typeof i.componentDidMount=="function"&&(t.flags|=4194308),r=!1)}else{i=t.stateNode,Bd(e,t),a=t.memoizedProps,c=t.type===t.elementType?a:it(t.type,a),i.props=c,f=t.pendingProps,h=i.context,u=n.contextType,typeof u=="object"&&u!==null?u=Je(u):(u=Me(n)?hn:Ce.current,u=qn(t,u));var _=n.getDerivedStateFromProps;(d=typeof _=="function"||typeof i.getSnapshotBeforeUpdate=="function")||typeof i.UNSAFE_componentWillReceiveProps!="function"&&typeof i.componentWillReceiveProps!="function"||(a!==f||h!==u)&&Ou(t,i,r,u),zt=!1,h=t.memoizedState,i.state=h,ol(t,r,i,o);var w=t.memoizedState;a!==f||h!==w||be.current||zt?(typeof _=="function"&&(ys(t,n,_,r),w=t.memoizedState),(c=zt||Mu(t,n,c,r,h,w,u)||!1)?(d||typeof i.UNSAFE_componentWillUpdate!="function"&&typeof i.componentWillUpdate!="function"||(typeof i.componentWillUpdate=="function"&&i.componentWillUpdate(r,w,u),typeof i.UNSAFE_componentWillUpdate=="function"&&i.UNSAFE_componentWillUpdate(r,w,u)),typeof i.componentDidUpdate=="function"&&(t.flags|=4),typeof i.getSnapshotBeforeUpdate=="function"&&(t.flags|=1024)):(typeof i.componentDidUpdate!="function"||a===e.memoizedProps&&h===e.memoizedState||(t.flags|=4),typeof i.getSnapshotBeforeUpdate!="function"||a===e.memoizedProps&&h===e.memoizedState||(t.flags|=1024),t.memoizedProps=r,t.memoizedState=w),i.props=r,i.state=w,i.context=u,r=c):(typeof i.componentDidUpdate!="function"||a===e.memoizedProps&&h===e.memoizedState||(t.flags|=4),typeof i.getSnapshotBeforeUpdate!="function"||a===e.memoizedProps&&h===e.memoizedState||(t.flags|=1024),r=!1)}return ws(e,t,n,r,l,o)}function ws(e,t,n,r,o,l){ff(e,t);var i=(t.flags&128)!==0;if(!r&&!i)return o&&Nu(t,n,!1),$t(e,t,l);r=t.stateNode,Gh.current=t;var a=i&&typeof n.getDerivedStateFromError!="function"?null:r.render();return t.flags|=1,e!==null&&i?(t.child=Gn(t,e.child,null,l),t.child=Gn(t,null,a,l)):Ne(e,t,a,l),t.memoizedState=r.state,o&&Nu(t,n,!0),t.child}function pf(e){var t=e.stateNode;t.pendingContext?Cu(e,t.pendingContext,t.pendingContext!==t.context):t.context&&Cu(e,t.context,!1),ua(e,t.containerInfo)}function Hu(e,t,n,r,o){return Kn(),ra(o),t.flags|=256,Ne(e,t,n,r),t.child}var xs={dehydrated:null,treeContext:null,retryLane:0};function Ss(e){return{baseLanes:e,cachePool:null,transitions:null}}function mf(e,t,n){var r=t.pendingProps,o=re.current,l=!1,i=(t.flags&128)!==0,a;if((a=i)||(a=e!==null&&e.memoizedState===null?!1:(o&2)!==0),a?(l=!0,t.flags&=-129):(e===null||e.memoizedState!==null)&&(o|=1),J(re,o&1),e===null)return ms(t),e=t.memoizedState,e!==null&&(e=e.dehydrated,e!==null)?(t.mode&1?e.data==="$!"?t.lanes=8:t.lanes=1073741824:t.lanes=1,null):(i=r.children,e=r.fallback,l?(r=t.mode,l=t.child,i={mode:"hidden",children:i},!(r&1)&&l!==null?(l.childLanes=0,l.pendingProps=i):l=$l(i,r,0,null),e=mn(e,r,n,null),l.return=t,e.return=t,l.sibling=e,t.child=l,t.child.memoizedState=Ss(n),t.memoizedState=xs,e):ga(t,i));if(o=e.memoizedState,o!==null&&(a=o.dehydrated,a!==null))return Yh(e,t,i,r,a,o,n);if(l){l=r.fallback,i=t.mode,o=e.child,a=o.sibling;var u={mode:"hidden",children:r.children};return!(i&1)&&t.child!==o?(r=t.child,r.childLanes=0,r.pendingProps=u,t.deletions=null):(r=Gt(o,u),r.subtreeFlags=o.subtreeFlags&14680064),a!==null?l=Gt(a,l):(l=mn(l,i,n,null),l.flags|=2),l.return=t,r.return=t,r.sibling=l,t.child=r,r=l,l=t.child,i=e.child.memoizedState,i=i===null?Ss(n):{baseLanes:i.baseLanes|n,cachePool:null,transitions:i.transitions},l.memoizedState=i,l.childLanes=e.childLanes&~n,t.memoizedState=xs,r}return l=e.child,e=l.sibling,r=Gt(l,{mode:"visible",children:r.children}),!(t.mode&1)&&(r.lanes=n),r.return=t,r.sibling=null,e!==null&&(n=t.deletions,n===null?(t.deletions=[e],t.flags|=16):n.push(e)),t.child=r,t.memoizedState=null,r}function ga(e,t){return t=$l({mode:"visible",children:t},e.mode,0,null),t.return=e,e.child=t}function So(e,t,n,r){return r!==null&&ra(r),Gn(t,e.child,null,n),e=ga(t,t.pendingProps.children),e.flags|=2,t.memoizedState=null,e}function Yh(e,t,n,r,o,l,i){if(n)return t.flags&256?(t.flags&=-257,r=Pi(Error(j(422))),So(e,t,i,r)):t.memoizedState!==null?(t.child=e.child,t.flags|=128,null):(l=r.fallback,o=t.mode,r=$l({mode:"visible",children:r.children},o,0,null),l=mn(l,o,i,null),l.flags|=2,r.return=t,l.return=t,r.sibling=l,t.child=r,t.mode&1&&Gn(t,e.child,null,i),t.child.memoizedState=Ss(i),t.memoizedState=xs,l);if(!(t.mode&1))return So(e,t,i,null);if(o.data==="$!"){if(r=o.nextSibling&&o.nextSibling.dataset,r)var a=r.dgst;return r=a,l=Error(j(419)),r=Pi(l,r,void 0),So(e,t,i,r)}if(a=(i&e.childLanes)!==0,Te||a){if(r=ye,r!==null){switch(i&-i){case 4:o=2;break;case 16:o=8;break;case 64:case 128:case 256:case 512:case 1024:case 2048:case 4096:case 8192:case 16384:case 32768:case 65536:case 131072:case 262144:case 524288:case 1048576:case 2097152:case 4194304:case 8388608:case 16777216:case 33554432:case 67108864:o=32;break;case 536870912:o=268435456;break;default:o=0}o=o&(r.suspendedLanes|i)?0:o,o!==0&&o!==l.retryLane&&(l.retryLane=o,It(e,o),ct(r,e,o,-1))}return ka(),r=Pi(Error(j(421))),So(e,t,i,r)}return o.data==="$?"?(t.flags|=128,t.child=e.child,t=uy.bind(null,e),o._reactRetry=t,null):(e=l.treeContext,De=Wt(o.nextSibling),Ue=t,ne=!0,at=null,e!==null&&(Ke[Ge++]=Ct,Ke[Ge++]=Nt,Ke[Ge++]=yn,Ct=e.id,Nt=e.overflow,yn=t),t=ga(t,r.children),t.flags|=4096,t)}function Vu(e,t,n){e.lanes|=t;var r=e.alternate;r!==null&&(r.lanes|=t),hs(e.return,t,n)}function Li(e,t,n,r,o){var l=e.memoizedState;l===null?e.memoizedState={isBackwards:t,rendering:null,renderingStartTime:0,last:r,tail:n,tailMode:o}:(l.isBackwards=t,l.rendering=null,l.renderingStartTime=0,l.last=r,l.tail=n,l.tailMode=o)}function hf(e,t,n){var r=t.pendingProps,o=r.revealOrder,l=r.tail;if(Ne(e,t,r.children,n),r=re.current,r&2)r=r&1|2,t.flags|=128;else{if(e!==null&&e.flags&128)e:for(e=t.child;e!==null;){if(e.tag===13)e.memoizedState!==null&&Vu(e,n,t);else if(e.tag===19)Vu(e,n,t);else if(e.child!==null){e.child.return=e,e=e.child;continue}if(e===t)break e;for(;e.sibling===null;){if(e.return===null||e.return===t)break e;e=e.return}e.sibling.return=e.return,e=e.sibling}r&=1}if(J(re,r),!(t.mode&1))t.memoizedState=null;else switch(o){case"forwards":for(n=t.child,o=null;n!==null;)e=n.alternate,e!==null&&ll(e)===null&&(o=n),n=n.sibling;n=o,n===null?(o=t.child,t.child=null):(o=n.sibling,n.sibling=null),Li(t,!1,o,n,l);break;case"backwards":for(n=null,o=t.child,t.child=null;o!==null;){if(e=o.alternate,e!==null&&ll(e)===null){t.child=o;break}e=o.sibling,o.sibling=n,n=o,o=e}Li(t,!0,n,null,l);break;case"together":Li(t,!1,null,null,void 0);break;default:t.memoizedState=null}return t.child}function zo(e,t){!(t.mode&1)&&e!==null&&(e.alternate=null,t.alternate=null,t.flags|=2)}function $t(e,t,n){if(e!==null&&(t.dependencies=e.dependencies),vn|=t.lanes,!(n&t.childLanes))return null;if(e!==null&&t.child!==e.child)throw Error(j(153));if(t.child!==null){for(e=t.child,n=Gt(e,e.pendingProps),t.child=n,n.return=t;e.sibling!==null;)e=e.sibling,n=n.sibling=Gt(e,e.pendingProps),n.return=t;n.sibling=null}return t.child}function Xh(e,t,n){switch(t.tag){case 3:pf(t),Kn();break;case 5:Fd(t);break;case 1:Me(t.type)&&Zo(t);break;case 4:ua(t,t.stateNode.containerInfo);break;case 10:var r=t.type._context,o=t.memoizedProps.value;J(nl,r._currentValue),r._currentValue=o;break;case 13:if(r=t.memoizedState,r!==null)return r.dehydrated!==null?(J(re,re.current&1),t.flags|=128,null):n&t.child.childLanes?mf(e,t,n):(J(re,re.current&1),e=$t(e,t,n),e!==null?e.sibling:null);J(re,re.current&1);break;case 19:if(r=(n&t.childLanes)!==0,e.flags&128){if(r)return hf(e,t,n);t.flags|=128}if(o=t.memoizedState,o!==null&&(o.rendering=null,o.tail=null,o.lastEffect=null),J(re,re.current),r)break;return null;case 22:case 23:return t.lanes=0,df(e,t,n)}return $t(e,t,n)}var yf,ks,gf,vf;yf=function(e,t){for(var n=t.child;n!==null;){if(n.tag===5||n.tag===6)e.appendChild(n.stateNode);else if(n.tag!==4&&n.child!==null){n.child.return=n,n=n.child;continue}if(n===t)break;for(;n.sibling===null;){if(n.return===null||n.return===t)return;n=n.return}n.sibling.return=n.return,n=n.sibling}};ks=function(){};gf=function(e,t,n,r){var o=e.memoizedProps;if(o!==r){e=t.stateNode,cn(wt.current);var l=null;switch(n){case"input":o=Wi(e,o),r=Wi(e,r),l=[];break;case"select":o=ie({},o,{value:void 0}),r=ie({},r,{value:void 0}),l=[];break;case"textarea":o=Ki(e,o),r=Ki(e,r),l=[];break;default:typeof o.onClick!="function"&&typeof r.onClick=="function"&&(e.onclick=Xo)}Yi(n,r);var i;n=null;for(c in o)if(!r.hasOwnProperty(c)&&o.hasOwnProperty(c)&&o[c]!=null)if(c==="style"){var a=o[c];for(i in a)a.hasOwnProperty(i)&&(n||(n={}),n[i]="")}else c!=="dangerouslySetInnerHTML"&&c!=="children"&&c!=="suppressContentEditableWarning"&&c!=="suppressHydrationWarning"&&c!=="autoFocus"&&(Tr.hasOwnProperty(c)?l||(l=[]):(l=l||[]).push(c,null));for(c in r){var u=r[c];if(a=o!=null?o[c]:void 0,r.hasOwnProperty(c)&&u!==a&&(u!=null||a!=null))if(c==="style")if(a){for(i in a)!a.hasOwnProperty(i)||u&&u.hasOwnProperty(i)||(n||(n={}),n[i]="");for(i in u)u.hasOwnProperty(i)&&a[i]!==u[i]&&(n||(n={}),n[i]=u[i])}else n||(l||(l=[]),l.push(c,n)),n=u;else c==="dangerouslySetInnerHTML"?(u=u?u.__html:void 0,a=a?a.__html:void 0,u!=null&&a!==u&&(l=l||[]).push(c,u)):c==="children"?typeof u!="string"&&typeof u!="number"||(l=l||[]).push(c,""+u):c!=="suppressContentEditableWarning"&&c!=="suppressHydrationWarning"&&(Tr.hasOwnProperty(c)?(u!=null&&c==="onScroll"&&ee("scroll",e),l||a===u||(l=[])):(l=l||[]).push(c,u))}n&&(l=l||[]).push("style",n);var c=l;(t.updateQueue=c)&&(t.flags|=4)}};vf=function(e,t,n,r){n!==r&&(t.flags|=4)};function pr(e,t){if(!ne)switch(e.tailMode){case"hidden":t=e.tail;for(var n=null;t!==null;)t.alternate!==null&&(n=t),t=t.sibling;n===null?e.tail=null:n.sibling=null;break;case"collapsed":n=e.tail;for(var r=null;n!==null;)n.alternate!==null&&(r=n),n=n.sibling;r===null?t||e.tail===null?e.tail=null:e.tail.sibling=null:r.sibling=null}}function Se(e){var t=e.alternate!==null&&e.alternate.child===e.child,n=0,r=0;if(t)for(var o=e.child;o!==null;)n|=o.lanes|o.childLanes,r|=o.subtreeFlags&14680064,r|=o.flags&14680064,o.return=e,o=o.sibling;else for(o=e.child;o!==null;)n|=o.lanes|o.childLanes,r|=o.subtreeFlags,r|=o.flags,o.return=e,o=o.sibling;return e.subtreeFlags|=r,e.childLanes=n,t}function Jh(e,t,n){var r=t.pendingProps;switch(na(t),t.tag){case 2:case 16:case 15:case 0:case 11:case 7:case 8:case 12:case 9:case 14:return Se(t),null;case 1:return Me(t.type)&&Jo(),Se(t),null;case 3:return r=t.stateNode,Yn(),te(be),te(Ce),da(),r.pendingContext&&(r.context=r.pendingContext,r.pendingContext=null),(e===null||e.child===null)&&(wo(t)?t.flags|=4:e===null||e.memoizedState.isDehydrated&&!(t.flags&256)||(t.flags|=1024,at!==null&&(Is(at),at=null))),ks(e,t),Se(t),null;case 5:ca(t);var o=cn(Wr.current);if(n=t.type,e!==null&&t.stateNode!=null)gf(e,t,n,r,o),e.ref!==t.ref&&(t.flags|=512,t.flags|=2097152);else{if(!r){if(t.stateNode===null)throw Error(j(166));return Se(t),null}if(e=cn(wt.current),wo(t)){r=t.stateNode,n=t.type;var l=t.memoizedProps;switch(r[vt]=t,r[Hr]=l,e=(t.mode&1)!==0,n){case"dialog":ee("cancel",r),ee("close",r);break;case"iframe":case"object":case"embed":ee("load",r);break;case"video":case"audio":for(o=0;o<Sr.length;o++)ee(Sr[o],r);break;case"source":ee("error",r);break;case"img":case"image":case"link":ee("error",r),ee("load",r);break;case"details":ee("toggle",r);break;case"input":Za(r,l),ee("invalid",r);break;case"select":r._wrapperState={wasMultiple:!!l.multiple},ee("invalid",r);break;case"textarea":tu(r,l),ee("invalid",r)}Yi(n,l),o=null;for(var i in l)if(l.hasOwnProperty(i)){var a=l[i];i==="children"?typeof a=="string"?r.textContent!==a&&(l.suppressHydrationWarning!==!0&&_o(r.textContent,a,e),o=["children",a]):typeof a=="number"&&r.textContent!==""+a&&(l.suppressHydrationWarning!==!0&&_o(r.textContent,a,e),o=["children",""+a]):Tr.hasOwnProperty(i)&&a!=null&&i==="onScroll"&&ee("scroll",r)}switch(n){case"input":co(r),eu(r,l,!0);break;case"textarea":co(r),nu(r);break;case"select":case"option":break;default:typeof l.onClick=="function"&&(r.onclick=Xo)}r=o,t.updateQueue=r,r!==null&&(t.flags|=4)}else{i=o.nodeType===9?o:o.ownerDocument,e==="http://www.w3.org/1999/xhtml"&&(e=Wc(n)),e==="http://www.w3.org/1999/xhtml"?n==="script"?(e=i.createElement("div"),e.innerHTML="<script><\/script>",e=e.removeChild(e.firstChild)):typeof r.is=="string"?e=i.createElement(n,{is:r.is}):(e=i.createElement(n),n==="select"&&(i=e,r.multiple?i.multiple=!0:r.size&&(i.size=r.size))):e=i.createElementNS(e,n),e[vt]=t,e[Hr]=r,yf(e,t,!1,!1),t.stateNode=e;e:{switch(i=Xi(n,r),n){case"dialog":ee("cancel",e),ee("close",e),o=r;break;case"iframe":case"object":case"embed":ee("load",e),o=r;break;case"video":case"audio":for(o=0;o<Sr.length;o++)ee(Sr[o],e);o=r;break;case"source":ee("error",e),o=r;break;case"img":case"image":case"link":ee("error",e),ee("load",e),o=r;break;case"details":ee("toggle",e),o=r;break;case"input":Za(e,r),o=Wi(e,r),ee("invalid",e);break;case"option":o=r;break;case"select":e._wrapperState={wasMultiple:!!r.multiple},o=ie({},r,{value:void 0}),ee("invalid",e);break;case"textarea":tu(e,r),o=Ki(e,r),ee("invalid",e);break;default:o=r}Yi(n,o),a=o;for(l in a)if(a.hasOwnProperty(l)){var u=a[l];l==="style"?Kc(e,u):l==="dangerouslySetInnerHTML"?(u=u?u.__html:void 0,u!=null&&Qc(e,u)):l==="children"?typeof u=="string"?(n!=="textarea"||u!=="")&&br(e,u):typeof u=="number"&&br(e,""+u):l!=="suppressContentEditableWarning"&&l!=="suppressHydrationWarning"&&l!=="autoFocus"&&(Tr.hasOwnProperty(l)?u!=null&&l==="onScroll"&&ee("scroll",e):u!=null&&Ds(e,l,u,i))}switch(n){case"input":co(e),eu(e,r,!1);break;case"textarea":co(e),nu(e);break;case"option":r.value!=null&&e.setAttribute("value",""+Yt(r.value));break;case"select":e.multiple=!!r.multiple,l=r.value,l!=null?Fn(e,!!r.multiple,l,!1):r.defaultValue!=null&&Fn(e,!!r.multiple,r.defaultValue,!0);break;default:typeof o.onClick=="function"&&(e.onclick=Xo)}switch(n){case"button":case"input":case"select":case"textarea":r=!!r.autoFocus;break e;case"img":r=!0;break e;default:r=!1}}r&&(t.flags|=4)}t.ref!==null&&(t.flags|=512,t.flags|=2097152)}return Se(t),null;case 6:if(e&&t.stateNode!=null)vf(e,t,e.memoizedProps,r);else{if(typeof r!="string"&&t.stateNode===null)throw Error(j(166));if(n=cn(Wr.current),cn(wt.current),wo(t)){if(r=t.stateNode,n=t.memoizedProps,r[vt]=t,(l=r.nodeValue!==n)&&(e=Ue,e!==null))switch(e.tag){case 3:_o(r.nodeValue,n,(e.mode&1)!==0);break;case 5:e.memoizedProps.suppressHydrationWarning!==!0&&_o(r.nodeValue,n,(e.mode&1)!==0)}l&&(t.flags|=4)}else r=(n.nodeType===9?n:n.ownerDocument).createTextNode(r),r[vt]=t,t.stateNode=r}return Se(t),null;case 13:if(te(re),r=t.memoizedState,e===null||e.memoizedState!==null&&e.memoizedState.dehydrated!==null){if(ne&&De!==null&&t.mode&1&&!(t.flags&128))Md(),Kn(),t.flags|=98560,l=!1;else if(l=wo(t),r!==null&&r.dehydrated!==null){if(e===null){if(!l)throw Error(j(318));if(l=t.memoizedState,l=l!==null?l.dehydrated:null,!l)throw Error(j(317));l[vt]=t}else Kn(),!(t.flags&128)&&(t.memoizedState=null),t.flags|=4;Se(t),l=!1}else at!==null&&(Is(at),at=null),l=!0;if(!l)return t.flags&65536?t:null}return t.flags&128?(t.lanes=n,t):(r=r!==null,r!==(e!==null&&e.memoizedState!==null)&&r&&(t.child.flags|=8192,t.mode&1&&(e===null||re.current&1?me===0&&(me=3):ka())),t.updateQueue!==null&&(t.flags|=4),Se(t),null);case 4:return Yn(),ks(e,t),e===null&&Dr(t.stateNode.containerInfo),Se(t),null;case 10:return ia(t.type._context),Se(t),null;case 17:return Me(t.type)&&Jo(),Se(t),null;case 19:if(te(re),l=t.memoizedState,l===null)return Se(t),null;if(r=(t.flags&128)!==0,i=l.rendering,i===null)if(r)pr(l,!1);else{if(me!==0||e!==null&&e.flags&128)for(e=t.child;e!==null;){if(i=ll(e),i!==null){for(t.flags|=128,pr(l,!1),r=i.updateQueue,r!==null&&(t.updateQueue=r,t.flags|=4),t.subtreeFlags=0,r=n,n=t.child;n!==null;)l=n,e=r,l.flags&=14680066,i=l.alternate,i===null?(l.childLanes=0,l.lanes=e,l.child=null,l.subtreeFlags=0,l.memoizedProps=null,l.memoizedState=null,l.updateQueue=null,l.dependencies=null,l.stateNode=null):(l.childLanes=i.childLanes,l.lanes=i.lanes,l.child=i.child,l.subtreeFlags=0,l.deletions=null,l.memoizedProps=i.memoizedProps,l.memoizedState=i.memoizedState,l.updateQueue=i.updateQueue,l.type=i.type,e=i.dependencies,l.dependencies=e===null?null:{lanes:e.lanes,firstContext:e.firstContext}),n=n.sibling;return J(re,re.current&1|2),t.child}e=e.sibling}l.tail!==null&&ce()>Jn&&(t.flags|=128,r=!0,pr(l,!1),t.lanes=4194304)}else{if(!r)if(e=ll(i),e!==null){if(t.flags|=128,r=!0,n=e.updateQueue,n!==null&&(t.updateQueue=n,t.flags|=4),pr(l,!0),l.tail===null&&l.tailMode==="hidden"&&!i.alternate&&!ne)return Se(t),null}else 2*ce()-l.renderingStartTime>Jn&&n!==1073741824&&(t.flags|=128,r=!0,pr(l,!1),t.lanes=4194304);l.isBackwards?(i.sibling=t.child,t.child=i):(n=l.last,n!==null?n.sibling=i:t.child=i,l.last=i)}return l.tail!==null?(t=l.tail,l.rendering=t,l.tail=t.sibling,l.renderingStartTime=ce(),t.sibling=null,n=re.current,J(re,r?n&1|2:n&1),t):(Se(t),null);case 22:case 23:return Sa(),r=t.memoizedState!==null,e!==null&&e.memoizedState!==null!==r&&(t.flags|=8192),r&&t.mode&1?Fe&1073741824&&(Se(t),t.subtreeFlags&6&&(t.flags|=8192)):Se(t),null;case 24:return null;case 25:return null}throw Error(j(156,t.tag))}function Zh(e,t){switch(na(t),t.tag){case 1:return Me(t.type)&&Jo(),e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 3:return Yn(),te(be),te(Ce),da(),e=t.flags,e&65536&&!(e&128)?(t.flags=e&-65537|128,t):null;case 5:return ca(t),null;case 13:if(te(re),e=t.memoizedState,e!==null&&e.dehydrated!==null){if(t.alternate===null)throw Error(j(340));Kn()}return e=t.flags,e&65536?(t.flags=e&-65537|128,t):null;case 19:return te(re),null;case 4:return Yn(),null;case 10:return ia(t.type._context),null;case 22:case 23:return Sa(),null;case 24:return null;default:return null}}var ko=!1,je=!1,ey=typeof WeakSet=="function"?WeakSet:Set,L=null;function An(e,t){var n=e.ref;if(n!==null)if(typeof n=="function")try{n(null)}catch(r){se(e,t,r)}else n.current=null}function Es(e,t,n){try{n()}catch(r){se(e,t,r)}}var Wu=!1;function ty(e,t){if(ss=Ko,e=Sd(),ea(e)){if("selectionStart"in e)var n={start:e.selectionStart,end:e.selectionEnd};else e:{n=(n=e.ownerDocument)&&n.defaultView||window;var r=n.getSelection&&n.getSelection();if(r&&r.rangeCount!==0){n=r.anchorNode;var o=r.anchorOffset,l=r.focusNode;r=r.focusOffset;try{n.nodeType,l.nodeType}catch{n=null;break e}var i=0,a=-1,u=-1,c=0,d=0,f=e,h=null;t:for(;;){for(var _;f!==n||o!==0&&f.nodeType!==3||(a=i+o),f!==l||r!==0&&f.nodeType!==3||(u=i+r),f.nodeType===3&&(i+=f.nodeValue.length),(_=f.firstChild)!==null;)h=f,f=_;for(;;){if(f===e)break t;if(h===n&&++c===o&&(a=i),h===l&&++d===r&&(u=i),(_=f.nextSibling)!==null)break;f=h,h=f.parentNode}f=_}n=a===-1||u===-1?null:{start:a,end:u}}else n=null}n=n||{start:0,end:0}}else n=null;for(as={focusedElem:e,selectionRange:n},Ko=!1,L=t;L!==null;)if(t=L,e=t.child,(t.subtreeFlags&1028)!==0&&e!==null)e.return=t,L=e;else for(;L!==null;){t=L;try{var w=t.alternate;if(t.flags&1024)switch(t.tag){case 0:case 11:case 15:break;case 1:if(w!==null){var v=w.memoizedProps,S=w.memoizedState,p=t.stateNode,m=p.getSnapshotBeforeUpdate(t.elementType===t.type?v:it(t.type,v),S);p.__reactInternalSnapshotBeforeUpdate=m}break;case 3:var y=t.stateNode.containerInfo;y.nodeType===1?y.textContent="":y.nodeType===9&&y.documentElement&&y.removeChild(y.documentElement);break;case 5:case 6:case 4:case 17:break;default:throw Error(j(163))}}catch(x){se(t,t.return,x)}if(e=t.sibling,e!==null){e.return=t.return,L=e;break}L=t.return}return w=Wu,Wu=!1,w}function Lr(e,t,n){var r=t.updateQueue;if(r=r!==null?r.lastEffect:null,r!==null){var o=r=r.next;do{if((o.tag&e)===e){var l=o.destroy;o.destroy=void 0,l!==void 0&&Es(t,n,l)}o=o.next}while(o!==r)}}function Ll(e,t){if(t=t.updateQueue,t=t!==null?t.lastEffect:null,t!==null){var n=t=t.next;do{if((n.tag&e)===e){var r=n.create;n.destroy=r()}n=n.next}while(n!==t)}}function js(e){var t=e.ref;if(t!==null){var n=e.stateNode;switch(e.tag){case 5:e=n;break;default:e=n}typeof t=="function"?t(e):t.current=e}}function _f(e){var t=e.alternate;t!==null&&(e.alternate=null,_f(t)),e.child=null,e.deletions=null,e.sibling=null,e.tag===5&&(t=e.stateNode,t!==null&&(delete t[vt],delete t[Hr],delete t[ds],delete t[zh],delete t[Ah])),e.stateNode=null,e.return=null,e.dependencies=null,e.memoizedProps=null,e.memoizedState=null,e.pendingProps=null,e.stateNode=null,e.updateQueue=null}function wf(e){return e.tag===5||e.tag===3||e.tag===4}function Qu(e){e:for(;;){for(;e.sibling===null;){if(e.return===null||wf(e.return))return null;e=e.return}for(e.sibling.return=e.return,e=e.sibling;e.tag!==5&&e.tag!==6&&e.tag!==18;){if(e.flags&2||e.child===null||e.tag===4)continue e;e.child.return=e,e=e.child}if(!(e.flags&2))return e.stateNode}}function Cs(e,t,n){var r=e.tag;if(r===5||r===6)e=e.stateNode,t?n.nodeType===8?n.parentNode.insertBefore(e,t):n.insertBefore(e,t):(n.nodeType===8?(t=n.parentNode,t.insertBefore(e,n)):(t=n,t.appendChild(e)),n=n._reactRootContainer,n!=null||t.onclick!==null||(t.onclick=Xo));else if(r!==4&&(e=e.child,e!==null))for(Cs(e,t,n),e=e.sibling;e!==null;)Cs(e,t,n),e=e.sibling}function Ns(e,t,n){var r=e.tag;if(r===5||r===6)e=e.stateNode,t?n.insertBefore(e,t):n.appendChild(e);else if(r!==4&&(e=e.child,e!==null))for(Ns(e,t,n),e=e.sibling;e!==null;)Ns(e,t,n),e=e.sibling}var ve=null,st=!1;function Mt(e,t,n){for(n=n.child;n!==null;)xf(e,t,n),n=n.sibling}function xf(e,t,n){if(_t&&typeof _t.onCommitFiberUnmount=="function")try{_t.onCommitFiberUnmount(Sl,n)}catch{}switch(n.tag){case 5:je||An(n,t);case 6:var r=ve,o=st;ve=null,Mt(e,t,n),ve=r,st=o,ve!==null&&(st?(e=ve,n=n.stateNode,e.nodeType===8?e.parentNode.removeChild(n):e.removeChild(n)):ve.removeChild(n.stateNode));break;case 18:ve!==null&&(st?(e=ve,n=n.stateNode,e.nodeType===8?ki(e.parentNode,n):e.nodeType===1&&ki(e,n),Ar(e)):ki(ve,n.stateNode));break;case 4:r=ve,o=st,ve=n.stateNode.containerInfo,st=!0,Mt(e,t,n),ve=r,st=o;break;case 0:case 11:case 14:case 15:if(!je&&(r=n.updateQueue,r!==null&&(r=r.lastEffect,r!==null))){o=r=r.next;do{var l=o,i=l.destroy;l=l.tag,i!==void 0&&(l&2||l&4)&&Es(n,t,i),o=o.next}while(o!==r)}Mt(e,t,n);break;case 1:if(!je&&(An(n,t),r=n.stateNode,typeof r.componentWillUnmount=="function"))try{r.props=n.memoizedProps,r.state=n.memoizedState,r.componentWillUnmount()}catch(a){se(n,t,a)}Mt(e,t,n);break;case 21:Mt(e,t,n);break;case 22:n.mode&1?(je=(r=je)||n.memoizedState!==null,Mt(e,t,n),je=r):Mt(e,t,n);break;default:Mt(e,t,n)}}function qu(e){var t=e.updateQueue;if(t!==null){e.updateQueue=null;var n=e.stateNode;n===null&&(n=e.stateNode=new ey),t.forEach(function(r){var o=cy.bind(null,e,r);n.has(r)||(n.add(r),r.then(o,o))})}}function rt(e,t){var n=t.deletions;if(n!==null)for(var r=0;r<n.length;r++){var o=n[r];try{var l=e,i=t,a=i;e:for(;a!==null;){switch(a.tag){case 5:ve=a.stateNode,st=!1;break e;case 3:ve=a.stateNode.containerInfo,st=!0;break e;case 4:ve=a.stateNode.containerInfo,st=!0;break e}a=a.return}if(ve===null)throw Error(j(160));xf(l,i,o),ve=null,st=!1;var u=o.alternate;u!==null&&(u.return=null),o.return=null}catch(c){se(o,t,c)}}if(t.subtreeFlags&12854)for(t=t.child;t!==null;)Sf(t,e),t=t.sibling}function Sf(e,t){var n=e.alternate,r=e.flags;switch(e.tag){case 0:case 11:case 14:case 15:if(rt(t,e),ht(e),r&4){try{Lr(3,e,e.return),Ll(3,e)}catch(v){se(e,e.return,v)}try{Lr(5,e,e.return)}catch(v){se(e,e.return,v)}}break;case 1:rt(t,e),ht(e),r&512&&n!==null&&An(n,n.return);break;case 5:if(rt(t,e),ht(e),r&512&&n!==null&&An(n,n.return),e.flags&32){var o=e.stateNode;try{br(o,"")}catch(v){se(e,e.return,v)}}if(r&4&&(o=e.stateNode,o!=null)){var l=e.memoizedProps,i=n!==null?n.memoizedProps:l,a=e.type,u=e.updateQueue;if(e.updateQueue=null,u!==null)try{a==="input"&&l.type==="radio"&&l.name!=null&&Hc(o,l),Xi(a,i);var c=Xi(a,l);for(i=0;i<u.length;i+=2){var d=u[i],f=u[i+1];d==="style"?Kc(o,f):d==="dangerouslySetInnerHTML"?Qc(o,f):d==="children"?br(o,f):Ds(o,d,f,c)}switch(a){case"input":Qi(o,l);break;case"textarea":Vc(o,l);break;case"select":var h=o._wrapperState.wasMultiple;o._wrapperState.wasMultiple=!!l.multiple;var _=l.value;_!=null?Fn(o,!!l.multiple,_,!1):h!==!!l.multiple&&(l.defaultValue!=null?Fn(o,!!l.multiple,l.defaultValue,!0):Fn(o,!!l.multiple,l.multiple?[]:"",!1))}o[Hr]=l}catch(v){se(e,e.return,v)}}break;case 6:if(rt(t,e),ht(e),r&4){if(e.stateNode===null)throw Error(j(162));o=e.stateNode,l=e.memoizedProps;try{o.nodeValue=l}catch(v){se(e,e.return,v)}}break;case 3:if(rt(t,e),ht(e),r&4&&n!==null&&n.memoizedState.isDehydrated)try{Ar(t.containerInfo)}catch(v){se(e,e.return,v)}break;case 4:rt(t,e),ht(e);break;case 13:rt(t,e),ht(e),o=e.child,o.flags&8192&&(l=o.memoizedState!==null,o.stateNode.isHidden=l,!l||o.alternate!==null&&o.alternate.memoizedState!==null||(wa=ce())),r&4&&qu(e);break;case 22:if(d=n!==null&&n.memoizedState!==null,e.mode&1?(je=(c=je)||d,rt(t,e),je=c):rt(t,e),ht(e),r&8192){if(c=e.memoizedState!==null,(e.stateNode.isHidden=c)&&!d&&e.mode&1)for(L=e,d=e.child;d!==null;){for(f=L=d;L!==null;){switch(h=L,_=h.child,h.tag){case 0:case 11:case 14:case 15:Lr(4,h,h.return);break;case 1:An(h,h.return);var w=h.stateNode;if(typeof w.componentWillUnmount=="function"){r=h,n=h.return;try{t=r,w.props=t.memoizedProps,w.state=t.memoizedState,w.componentWillUnmount()}catch(v){se(r,n,v)}}break;case 5:An(h,h.return);break;case 22:if(h.memoizedState!==null){Gu(f);continue}}_!==null?(_.return=h,L=_):Gu(f)}d=d.sibling}e:for(d=null,f=e;;){if(f.tag===5){if(d===null){d=f;try{o=f.stateNode,c?(l=o.style,typeof l.setProperty=="function"?l.setProperty("display","none","important"):l.display="none"):(a=f.stateNode,u=f.memoizedProps.style,i=u!=null&&u.hasOwnProperty("display")?u.display:null,a.style.display=qc("display",i))}catch(v){se(e,e.return,v)}}}else if(f.tag===6){if(d===null)try{f.stateNode.nodeValue=c?"":f.memoizedProps}catch(v){se(e,e.return,v)}}else if((f.tag!==22&&f.tag!==23||f.memoizedState===null||f===e)&&f.child!==null){f.child.return=f,f=f.child;continue}if(f===e)break e;for(;f.sibling===null;){if(f.return===null||f.return===e)break e;d===f&&(d=null),f=f.return}d===f&&(d=null),f.sibling.return=f.return,f=f.sibling}}break;case 19:rt(t,e),ht(e),r&4&&qu(e);break;case 21:break;default:rt(t,e),ht(e)}}function ht(e){var t=e.flags;if(t&2){try{e:{for(var n=e.return;n!==null;){if(wf(n)){var r=n;break e}n=n.return}throw Error(j(160))}switch(r.tag){case 5:var o=r.stateNode;r.flags&32&&(br(o,""),r.flags&=-33);var l=Qu(e);Ns(e,l,o);break;case 3:case 4:var i=r.stateNode.containerInfo,a=Qu(e);Cs(e,a,i);break;default:throw Error(j(161))}}catch(u){se(e,e.return,u)}e.flags&=-3}t&4096&&(e.flags&=-4097)}function ny(e,t,n){L=e,kf(e)}function kf(e,t,n){for(var r=(e.mode&1)!==0;L!==null;){var o=L,l=o.child;if(o.tag===22&&r){var i=o.memoizedState!==null||ko;if(!i){var a=o.alternate,u=a!==null&&a.memoizedState!==null||je;a=ko;var c=je;if(ko=i,(je=u)&&!c)for(L=o;L!==null;)i=L,u=i.child,i.tag===22&&i.memoizedState!==null?Yu(o):u!==null?(u.return=i,L=u):Yu(o);for(;l!==null;)L=l,kf(l),l=l.sibling;L=o,ko=a,je=c}Ku(e)}else o.subtreeFlags&8772&&l!==null?(l.return=o,L=l):Ku(e)}}function Ku(e){for(;L!==null;){var t=L;if(t.flags&8772){var n=t.alternate;try{if(t.flags&8772)switch(t.tag){case 0:case 11:case 15:je||Ll(5,t);break;case 1:var r=t.stateNode;if(t.flags&4&&!je)if(n===null)r.componentDidMount();else{var o=t.elementType===t.type?n.memoizedProps:it(t.type,n.memoizedProps);r.componentDidUpdate(o,n.memoizedState,r.__reactInternalSnapshotBeforeUpdate)}var l=t.updateQueue;l!==null&&$u(t,l,r);break;case 3:var i=t.updateQueue;if(i!==null){if(n=null,t.child!==null)switch(t.child.tag){case 5:n=t.child.stateNode;break;case 1:n=t.child.stateNode}$u(t,i,n)}break;case 5:var a=t.stateNode;if(n===null&&t.flags&4){n=a;var u=t.memoizedProps;switch(t.type){case"button":case"input":case"select":case"textarea":u.autoFocus&&n.focus();break;case"img":u.src&&(n.src=u.src)}}break;case 6:break;case 4:break;case 12:break;case 13:if(t.memoizedState===null){var c=t.alternate;if(c!==null){var d=c.memoizedState;if(d!==null){var f=d.dehydrated;f!==null&&Ar(f)}}}break;case 19:case 17:case 21:case 22:case 23:case 25:break;default:throw Error(j(163))}je||t.flags&512&&js(t)}catch(h){se(t,t.return,h)}}if(t===e){L=null;break}if(n=t.sibling,n!==null){n.return=t.return,L=n;break}L=t.return}}function Gu(e){for(;L!==null;){var t=L;if(t===e){L=null;break}var n=t.sibling;if(n!==null){n.return=t.return,L=n;break}L=t.return}}function Yu(e){for(;L!==null;){var t=L;try{switch(t.tag){case 0:case 11:case 15:var n=t.return;try{Ll(4,t)}catch(u){se(t,n,u)}break;case 1:var r=t.stateNode;if(typeof r.componentDidMount=="function"){var o=t.return;try{r.componentDidMount()}catch(u){se(t,o,u)}}var l=t.return;try{js(t)}catch(u){se(t,l,u)}break;case 5:var i=t.return;try{js(t)}catch(u){se(t,i,u)}}}catch(u){se(t,t.return,u)}if(t===e){L=null;break}var a=t.sibling;if(a!==null){a.return=t.return,L=a;break}L=t.return}}var ry=Math.ceil,al=bt.ReactCurrentDispatcher,va=bt.ReactCurrentOwner,Xe=bt.ReactCurrentBatchConfig,V=0,ye=null,de=null,_e=0,Fe=0,Bn=en(0),me=0,Gr=null,vn=0,Il=0,_a=0,Ir=null,$e=null,wa=0,Jn=1/0,Et=null,ul=!1,Rs=null,qt=null,Eo=!1,Dt=null,cl=0,$r=0,Ps=null,Ao=-1,Bo=0;function Re(){return V&6?ce():Ao!==-1?Ao:Ao=ce()}function Kt(e){return e.mode&1?V&2&&_e!==0?_e&-_e:Fh.transition!==null?(Bo===0&&(Bo=id()),Bo):(e=K,e!==0||(e=window.event,e=e===void 0?16:pd(e.type)),e):1}function ct(e,t,n,r){if(50<$r)throw $r=0,Ps=null,Error(j(185));eo(e,n,r),(!(V&2)||e!==ye)&&(e===ye&&(!(V&2)&&(Il|=n),me===4&&Bt(e,_e)),Oe(e,r),n===1&&V===0&&!(t.mode&1)&&(Jn=ce()+500,Nl&&tn()))}function Oe(e,t){var n=e.callbackNode;Fm(e,t);var r=qo(e,e===ye?_e:0);if(r===0)n!==null&&lu(n),e.callbackNode=null,e.callbackPriority=0;else if(t=r&-r,e.callbackPriority!==t){if(n!=null&&lu(n),t===1)e.tag===0?Bh(Xu.bind(null,e)):$d(Xu.bind(null,e)),Mh(function(){!(V&6)&&tn()}),n=null;else{switch(sd(r)){case 1:n=Qs;break;case 4:n=od;break;case 16:n=Qo;break;case 536870912:n=ld;break;default:n=Qo}n=If(n,Ef.bind(null,e))}e.callbackPriority=t,e.callbackNode=n}}function Ef(e,t){if(Ao=-1,Bo=0,V&6)throw Error(j(327));var n=e.callbackNode;if(Wn()&&e.callbackNode!==n)return null;var r=qo(e,e===ye?_e:0);if(r===0)return null;if(r&30||r&e.expiredLanes||t)t=dl(e,r);else{t=r;var o=V;V|=2;var l=Cf();(ye!==e||_e!==t)&&(Et=null,Jn=ce()+500,pn(e,t));do try{iy();break}catch(a){jf(e,a)}while(!0);la(),al.current=l,V=o,de!==null?t=0:(ye=null,_e=0,t=me)}if(t!==0){if(t===2&&(o=ns(e),o!==0&&(r=o,t=Ls(e,o))),t===1)throw n=Gr,pn(e,0),Bt(e,r),Oe(e,ce()),n;if(t===6)Bt(e,r);else{if(o=e.current.alternate,!(r&30)&&!oy(o)&&(t=dl(e,r),t===2&&(l=ns(e),l!==0&&(r=l,t=Ls(e,l))),t===1))throw n=Gr,pn(e,0),Bt(e,r),Oe(e,ce()),n;switch(e.finishedWork=o,e.finishedLanes=r,t){case 0:case 1:throw Error(j(345));case 2:sn(e,$e,Et);break;case 3:if(Bt(e,r),(r&130023424)===r&&(t=wa+500-ce(),10<t)){if(qo(e,0)!==0)break;if(o=e.suspendedLanes,(o&r)!==r){Re(),e.pingedLanes|=e.suspendedLanes&o;break}e.timeoutHandle=cs(sn.bind(null,e,$e,Et),t);break}sn(e,$e,Et);break;case 4:if(Bt(e,r),(r&4194240)===r)break;for(t=e.eventTimes,o=-1;0<r;){var i=31-ut(r);l=1<<i,i=t[i],i>o&&(o=i),r&=~l}if(r=o,r=ce()-r,r=(120>r?120:480>r?480:1080>r?1080:1920>r?1920:3e3>r?3e3:4320>r?4320:1960*ry(r/1960))-r,10<r){e.timeoutHandle=cs(sn.bind(null,e,$e,Et),r);break}sn(e,$e,Et);break;case 5:sn(e,$e,Et);break;default:throw Error(j(329))}}}return Oe(e,ce()),e.callbackNode===n?Ef.bind(null,e):null}function Ls(e,t){var n=Ir;return e.current.memoizedState.isDehydrated&&(pn(e,t).flags|=256),e=dl(e,t),e!==2&&(t=$e,$e=n,t!==null&&Is(t)),e}function Is(e){$e===null?$e=e:$e.push.apply($e,e)}function oy(e){for(var t=e;;){if(t.flags&16384){var n=t.updateQueue;if(n!==null&&(n=n.stores,n!==null))for(var r=0;r<n.length;r++){var o=n[r],l=o.getSnapshot;o=o.value;try{if(!ft(l(),o))return!1}catch{return!1}}}if(n=t.child,t.subtreeFlags&16384&&n!==null)n.return=t,t=n;else{if(t===e)break;for(;t.sibling===null;){if(t.return===null||t.return===e)return!0;t=t.return}t.sibling.return=t.return,t=t.sibling}}return!0}function Bt(e,t){for(t&=~_a,t&=~Il,e.suspendedLanes|=t,e.pingedLanes&=~t,e=e.expirationTimes;0<t;){var n=31-ut(t),r=1<<n;e[n]=-1,t&=~r}}function Xu(e){if(V&6)throw Error(j(327));Wn();var t=qo(e,0);if(!(t&1))return Oe(e,ce()),null;var n=dl(e,t);if(e.tag!==0&&n===2){var r=ns(e);r!==0&&(t=r,n=Ls(e,r))}if(n===1)throw n=Gr,pn(e,0),Bt(e,t),Oe(e,ce()),n;if(n===6)throw Error(j(345));return e.finishedWork=e.current.alternate,e.finishedLanes=t,sn(e,$e,Et),Oe(e,ce()),null}function xa(e,t){var n=V;V|=1;try{return e(t)}finally{V=n,V===0&&(Jn=ce()+500,Nl&&tn())}}function _n(e){Dt!==null&&Dt.tag===0&&!(V&6)&&Wn();var t=V;V|=1;var n=Xe.transition,r=K;try{if(Xe.transition=null,K=1,e)return e()}finally{K=r,Xe.transition=n,V=t,!(V&6)&&tn()}}function Sa(){Fe=Bn.current,te(Bn)}function pn(e,t){e.finishedWork=null,e.finishedLanes=0;var n=e.timeoutHandle;if(n!==-1&&(e.timeoutHandle=-1,bh(n)),de!==null)for(n=de.return;n!==null;){var r=n;switch(na(r),r.tag){case 1:r=r.type.childContextTypes,r!=null&&Jo();break;case 3:Yn(),te(be),te(Ce),da();break;case 5:ca(r);break;case 4:Yn();break;case 13:te(re);break;case 19:te(re);break;case 10:ia(r.type._context);break;case 22:case 23:Sa()}n=n.return}if(ye=e,de=e=Gt(e.current,null),_e=Fe=t,me=0,Gr=null,_a=Il=vn=0,$e=Ir=null,un!==null){for(t=0;t<un.length;t++)if(n=un[t],r=n.interleaved,r!==null){n.interleaved=null;var o=r.next,l=n.pending;if(l!==null){var i=l.next;l.next=o,r.next=i}n.pending=r}un=null}return e}function jf(e,t){do{var n=de;try{if(la(),Mo.current=sl,il){for(var r=oe.memoizedState;r!==null;){var o=r.queue;o!==null&&(o.pending=null),r=r.next}il=!1}if(gn=0,he=pe=oe=null,Pr=!1,Qr=0,va.current=null,n===null||n.return===null){me=1,Gr=t,de=null;break}e:{var l=e,i=n.return,a=n,u=t;if(t=_e,a.flags|=32768,u!==null&&typeof u=="object"&&typeof u.then=="function"){var c=u,d=a,f=d.tag;if(!(d.mode&1)&&(f===0||f===11||f===15)){var h=d.alternate;h?(d.updateQueue=h.updateQueue,d.memoizedState=h.memoizedState,d.lanes=h.lanes):(d.updateQueue=null,d.memoizedState=null)}var _=Au(i);if(_!==null){_.flags&=-257,Bu(_,i,a,l,t),_.mode&1&&zu(l,c,t),t=_,u=c;var w=t.updateQueue;if(w===null){var v=new Set;v.add(u),t.updateQueue=v}else w.add(u);break e}else{if(!(t&1)){zu(l,c,t),ka();break e}u=Error(j(426))}}else if(ne&&a.mode&1){var S=Au(i);if(S!==null){!(S.flags&65536)&&(S.flags|=256),Bu(S,i,a,l,t),ra(Xn(u,a));break e}}l=u=Xn(u,a),me!==4&&(me=2),Ir===null?Ir=[l]:Ir.push(l),l=i;do{switch(l.tag){case 3:l.flags|=65536,t&=-t,l.lanes|=t;var p=af(l,u,t);Iu(l,p);break e;case 1:a=u;var m=l.type,y=l.stateNode;if(!(l.flags&128)&&(typeof m.getDerivedStateFromError=="function"||y!==null&&typeof y.componentDidCatch=="function"&&(qt===null||!qt.has(y)))){l.flags|=65536,t&=-t,l.lanes|=t;var x=uf(l,a,t);Iu(l,x);break e}}l=l.return}while(l!==null)}Rf(n)}catch(k){t=k,de===n&&n!==null&&(de=n=n.return);continue}break}while(!0)}function Cf(){var e=al.current;return al.current=sl,e===null?sl:e}function ka(){(me===0||me===3||me===2)&&(me=4),ye===null||!(vn&268435455)&&!(Il&268435455)||Bt(ye,_e)}function dl(e,t){var n=V;V|=2;var r=Cf();(ye!==e||_e!==t)&&(Et=null,pn(e,t));do try{ly();break}catch(o){jf(e,o)}while(!0);if(la(),V=n,al.current=r,de!==null)throw Error(j(261));return ye=null,_e=0,me}function ly(){for(;de!==null;)Nf(de)}function iy(){for(;de!==null&&!Im();)Nf(de)}function Nf(e){var t=Lf(e.alternate,e,Fe);e.memoizedProps=e.pendingProps,t===null?Rf(e):de=t,va.current=null}function Rf(e){var t=e;do{var n=t.alternate;if(e=t.return,t.flags&32768){if(n=Zh(n,t),n!==null){n.flags&=32767,de=n;return}if(e!==null)e.flags|=32768,e.subtreeFlags=0,e.deletions=null;else{me=6,de=null;return}}else if(n=Jh(n,t,Fe),n!==null){de=n;return}if(t=t.sibling,t!==null){de=t;return}de=t=e}while(t!==null);me===0&&(me=5)}function sn(e,t,n){var r=K,o=Xe.transition;try{Xe.transition=null,K=1,sy(e,t,n,r)}finally{Xe.transition=o,K=r}return null}function sy(e,t,n,r){do Wn();while(Dt!==null);if(V&6)throw Error(j(327));n=e.finishedWork;var o=e.finishedLanes;if(n===null)return null;if(e.finishedWork=null,e.finishedLanes=0,n===e.current)throw Error(j(177));e.callbackNode=null,e.callbackPriority=0;var l=n.lanes|n.childLanes;if(Dm(e,l),e===ye&&(de=ye=null,_e=0),!(n.subtreeFlags&2064)&&!(n.flags&2064)||Eo||(Eo=!0,If(Qo,function(){return Wn(),null})),l=(n.flags&15990)!==0,n.subtreeFlags&15990||l){l=Xe.transition,Xe.transition=null;var i=K;K=1;var a=V;V|=4,va.current=null,ty(e,n),Sf(n,e),Nh(as),Ko=!!ss,as=ss=null,e.current=n,ny(n),$m(),V=a,K=i,Xe.transition=l}else e.current=n;if(Eo&&(Eo=!1,Dt=e,cl=o),l=e.pendingLanes,l===0&&(qt=null),Mm(n.stateNode),Oe(e,ce()),t!==null)for(r=e.onRecoverableError,n=0;n<t.length;n++)o=t[n],r(o.value,{componentStack:o.stack,digest:o.digest});if(ul)throw ul=!1,e=Rs,Rs=null,e;return cl&1&&e.tag!==0&&Wn(),l=e.pendingLanes,l&1?e===Ps?$r++:($r=0,Ps=e):$r=0,tn(),null}function Wn(){if(Dt!==null){var e=sd(cl),t=Xe.transition,n=K;try{if(Xe.transition=null,K=16>e?16:e,Dt===null)var r=!1;else{if(e=Dt,Dt=null,cl=0,V&6)throw Error(j(331));var o=V;for(V|=4,L=e.current;L!==null;){var l=L,i=l.child;if(L.flags&16){var a=l.deletions;if(a!==null){for(var u=0;u<a.length;u++){var c=a[u];for(L=c;L!==null;){var d=L;switch(d.tag){case 0:case 11:case 15:Lr(8,d,l)}var f=d.child;if(f!==null)f.return=d,L=f;else for(;L!==null;){d=L;var h=d.sibling,_=d.return;if(_f(d),d===c){L=null;break}if(h!==null){h.return=_,L=h;break}L=_}}}var w=l.alternate;if(w!==null){var v=w.child;if(v!==null){w.child=null;do{var S=v.sibling;v.sibling=null,v=S}while(v!==null)}}L=l}}if(l.subtreeFlags&2064&&i!==null)i.return=l,L=i;else e:for(;L!==null;){if(l=L,l.flags&2048)switch(l.tag){case 0:case 11:case 15:Lr(9,l,l.return)}var p=l.sibling;if(p!==null){p.return=l.return,L=p;break e}L=l.return}}var m=e.current;for(L=m;L!==null;){i=L;var y=i.child;if(i.subtreeFlags&2064&&y!==null)y.return=i,L=y;else e:for(i=m;L!==null;){if(a=L,a.flags&2048)try{switch(a.tag){case 0:case 11:case 15:Ll(9,a)}}catch(k){se(a,a.return,k)}if(a===i){L=null;break e}var x=a.sibling;if(x!==null){x.return=a.return,L=x;break e}L=a.return}}if(V=o,tn(),_t&&typeof _t.onPostCommitFiberRoot=="function")try{_t.onPostCommitFiberRoot(Sl,e)}catch{}r=!0}return r}finally{K=n,Xe.transition=t}}return!1}function Ju(e,t,n){t=Xn(n,t),t=af(e,t,1),e=Qt(e,t,1),t=Re(),e!==null&&(eo(e,1,t),Oe(e,t))}function se(e,t,n){if(e.tag===3)Ju(e,e,n);else for(;t!==null;){if(t.tag===3){Ju(t,e,n);break}else if(t.tag===1){var r=t.stateNode;if(typeof t.type.getDerivedStateFromError=="function"||typeof r.componentDidCatch=="function"&&(qt===null||!qt.has(r))){e=Xn(n,e),e=uf(t,e,1),t=Qt(t,e,1),e=Re(),t!==null&&(eo(t,1,e),Oe(t,e));break}}t=t.return}}function ay(e,t,n){var r=e.pingCache;r!==null&&r.delete(t),t=Re(),e.pingedLanes|=e.suspendedLanes&n,ye===e&&(_e&n)===n&&(me===4||me===3&&(_e&130023424)===_e&&500>ce()-wa?pn(e,0):_a|=n),Oe(e,t)}function Pf(e,t){t===0&&(e.mode&1?(t=mo,mo<<=1,!(mo&130023424)&&(mo=4194304)):t=1);var n=Re();e=It(e,t),e!==null&&(eo(e,t,n),Oe(e,n))}function uy(e){var t=e.memoizedState,n=0;t!==null&&(n=t.retryLane),Pf(e,n)}function cy(e,t){var n=0;switch(e.tag){case 13:var r=e.stateNode,o=e.memoizedState;o!==null&&(n=o.retryLane);break;case 19:r=e.stateNode;break;default:throw Error(j(314))}r!==null&&r.delete(t),Pf(e,n)}var Lf;Lf=function(e,t,n){if(e!==null)if(e.memoizedProps!==t.pendingProps||be.current)Te=!0;else{if(!(e.lanes&n)&&!(t.flags&128))return Te=!1,Xh(e,t,n);Te=!!(e.flags&131072)}else Te=!1,ne&&t.flags&1048576&&Td(t,tl,t.index);switch(t.lanes=0,t.tag){case 2:var r=t.type;zo(e,t),e=t.pendingProps;var o=qn(t,Ce.current);Vn(t,n),o=pa(null,t,r,e,o,n);var l=ma();return t.flags|=1,typeof o=="object"&&o!==null&&typeof o.render=="function"&&o.$$typeof===void 0?(t.tag=1,t.memoizedState=null,t.updateQueue=null,Me(r)?(l=!0,Zo(t)):l=!1,t.memoizedState=o.state!==null&&o.state!==void 0?o.state:null,aa(t),o.updater=Pl,t.stateNode=o,o._reactInternals=t,gs(t,r,e,n),t=ws(null,t,r,!0,l,n)):(t.tag=0,ne&&l&&ta(t),Ne(null,t,o,n),t=t.child),t;case 16:r=t.elementType;e:{switch(zo(e,t),e=t.pendingProps,o=r._init,r=o(r._payload),t.type=r,o=t.tag=fy(r),e=it(r,e),o){case 0:t=_s(null,t,r,e,n);break e;case 1:t=Uu(null,t,r,e,n);break e;case 11:t=Fu(null,t,r,e,n);break e;case 14:t=Du(null,t,r,it(r.type,e),n);break e}throw Error(j(306,r,""))}return t;case 0:return r=t.type,o=t.pendingProps,o=t.elementType===r?o:it(r,o),_s(e,t,r,o,n);case 1:return r=t.type,o=t.pendingProps,o=t.elementType===r?o:it(r,o),Uu(e,t,r,o,n);case 3:e:{if(pf(t),e===null)throw Error(j(387));r=t.pendingProps,l=t.memoizedState,o=l.element,Bd(e,t),ol(t,r,null,n);var i=t.memoizedState;if(r=i.element,l.isDehydrated)if(l={element:r,isDehydrated:!1,cache:i.cache,pendingSuspenseBoundaries:i.pendingSuspenseBoundaries,transitions:i.transitions},t.updateQueue.baseState=l,t.memoizedState=l,t.flags&256){o=Xn(Error(j(423)),t),t=Hu(e,t,r,n,o);break e}else if(r!==o){o=Xn(Error(j(424)),t),t=Hu(e,t,r,n,o);break e}else for(De=Wt(t.stateNode.containerInfo.firstChild),Ue=t,ne=!0,at=null,n=zd(t,null,r,n),t.child=n;n;)n.flags=n.flags&-3|4096,n=n.sibling;else{if(Kn(),r===o){t=$t(e,t,n);break e}Ne(e,t,r,n)}t=t.child}return t;case 5:return Fd(t),e===null&&ms(t),r=t.type,o=t.pendingProps,l=e!==null?e.memoizedProps:null,i=o.children,us(r,o)?i=null:l!==null&&us(r,l)&&(t.flags|=32),ff(e,t),Ne(e,t,i,n),t.child;case 6:return e===null&&ms(t),null;case 13:return mf(e,t,n);case 4:return ua(t,t.stateNode.containerInfo),r=t.pendingProps,e===null?t.child=Gn(t,null,r,n):Ne(e,t,r,n),t.child;case 11:return r=t.type,o=t.pendingProps,o=t.elementType===r?o:it(r,o),Fu(e,t,r,o,n);case 7:return Ne(e,t,t.pendingProps,n),t.child;case 8:return Ne(e,t,t.pendingProps.children,n),t.child;case 12:return Ne(e,t,t.pendingProps.children,n),t.child;case 10:e:{if(r=t.type._context,o=t.pendingProps,l=t.memoizedProps,i=o.value,J(nl,r._currentValue),r._currentValue=i,l!==null)if(ft(l.value,i)){if(l.children===o.children&&!be.current){t=$t(e,t,n);break e}}else for(l=t.child,l!==null&&(l.return=t);l!==null;){var a=l.dependencies;if(a!==null){i=l.child;for(var u=a.firstContext;u!==null;){if(u.context===r){if(l.tag===1){u=Rt(-1,n&-n),u.tag=2;var c=l.updateQueue;if(c!==null){c=c.shared;var d=c.pending;d===null?u.next=u:(u.next=d.next,d.next=u),c.pending=u}}l.lanes|=n,u=l.alternate,u!==null&&(u.lanes|=n),hs(l.return,n,t),a.lanes|=n;break}u=u.next}}else if(l.tag===10)i=l.type===t.type?null:l.child;else if(l.tag===18){if(i=l.return,i===null)throw Error(j(341));i.lanes|=n,a=i.alternate,a!==null&&(a.lanes|=n),hs(i,n,t),i=l.sibling}else i=l.child;if(i!==null)i.return=l;else for(i=l;i!==null;){if(i===t){i=null;break}if(l=i.sibling,l!==null){l.return=i.return,i=l;break}i=i.return}l=i}Ne(e,t,o.children,n),t=t.child}return t;case 9:return o=t.type,r=t.pendingProps.children,Vn(t,n),o=Je(o),r=r(o),t.flags|=1,Ne(e,t,r,n),t.child;case 14:return r=t.type,o=it(r,t.pendingProps),o=it(r.type,o),Du(e,t,r,o,n);case 15:return cf(e,t,t.type,t.pendingProps,n);case 17:return r=t.type,o=t.pendingProps,o=t.elementType===r?o:it(r,o),zo(e,t),t.tag=1,Me(r)?(e=!0,Zo(t)):e=!1,Vn(t,n),sf(t,r,o),gs(t,r,o,n),ws(null,t,r,!0,e,n);case 19:return hf(e,t,n);case 22:return df(e,t,n)}throw Error(j(156,t.tag))};function If(e,t){return rd(e,t)}function dy(e,t,n,r){this.tag=e,this.key=n,this.sibling=this.child=this.return=this.stateNode=this.type=this.elementType=null,this.index=0,this.ref=null,this.pendingProps=t,this.dependencies=this.memoizedState=this.updateQueue=this.memoizedProps=null,this.mode=r,this.subtreeFlags=this.flags=0,this.deletions=null,this.childLanes=this.lanes=0,this.alternate=null}function Ye(e,t,n,r){return new dy(e,t,n,r)}function Ea(e){return e=e.prototype,!(!e||!e.isReactComponent)}function fy(e){if(typeof e=="function")return Ea(e)?1:0;if(e!=null){if(e=e.$$typeof,e===Hs)return 11;if(e===Vs)return 14}return 2}function Gt(e,t){var n=e.alternate;return n===null?(n=Ye(e.tag,t,e.key,e.mode),n.elementType=e.elementType,n.type=e.type,n.stateNode=e.stateNode,n.alternate=e,e.alternate=n):(n.pendingProps=t,n.type=e.type,n.flags=0,n.subtreeFlags=0,n.deletions=null),n.flags=e.flags&14680064,n.childLanes=e.childLanes,n.lanes=e.lanes,n.child=e.child,n.memoizedProps=e.memoizedProps,n.memoizedState=e.memoizedState,n.updateQueue=e.updateQueue,t=e.dependencies,n.dependencies=t===null?null:{lanes:t.lanes,firstContext:t.firstContext},n.sibling=e.sibling,n.index=e.index,n.ref=e.ref,n}function Fo(e,t,n,r,o,l){var i=2;if(r=e,typeof e=="function")Ea(e)&&(i=1);else if(typeof e=="string")i=5;else e:switch(e){case Pn:return mn(n.children,o,l,t);case Us:i=8,o|=8;break;case Di:return e=Ye(12,n,t,o|2),e.elementType=Di,e.lanes=l,e;case Ui:return e=Ye(13,n,t,o),e.elementType=Ui,e.lanes=l,e;case Hi:return e=Ye(19,n,t,o),e.elementType=Hi,e.lanes=l,e;case Fc:return $l(n,o,l,t);default:if(typeof e=="object"&&e!==null)switch(e.$$typeof){case Ac:i=10;break e;case Bc:i=9;break e;case Hs:i=11;break e;case Vs:i=14;break e;case Ot:i=16,r=null;break e}throw Error(j(130,e==null?e:typeof e,""))}return t=Ye(i,n,t,o),t.elementType=e,t.type=r,t.lanes=l,t}function mn(e,t,n,r){return e=Ye(7,e,r,t),e.lanes=n,e}function $l(e,t,n,r){return e=Ye(22,e,r,t),e.elementType=Fc,e.lanes=n,e.stateNode={isHidden:!1},e}function Ii(e,t,n){return e=Ye(6,e,null,t),e.lanes=n,e}function $i(e,t,n){return t=Ye(4,e.children!==null?e.children:[],e.key,t),t.lanes=n,t.stateNode={containerInfo:e.containerInfo,pendingChildren:null,implementation:e.implementation},t}function py(e,t,n,r,o){this.tag=t,this.containerInfo=e,this.finishedWork=this.pingCache=this.current=this.pendingChildren=null,this.timeoutHandle=-1,this.callbackNode=this.pendingContext=this.context=null,this.callbackPriority=0,this.eventTimes=fi(0),this.expirationTimes=fi(-1),this.entangledLanes=this.finishedLanes=this.mutableReadLanes=this.expiredLanes=this.pingedLanes=this.suspendedLanes=this.pendingLanes=0,this.entanglements=fi(0),this.identifierPrefix=r,this.onRecoverableError=o,this.mutableSourceEagerHydrationData=null}function ja(e,t,n,r,o,l,i,a,u){return e=new py(e,t,n,a,u),t===1?(t=1,l===!0&&(t|=8)):t=0,l=Ye(3,null,null,t),e.current=l,l.stateNode=e,l.memoizedState={element:r,isDehydrated:n,cache:null,transitions:null,pendingSuspenseBoundaries:null},aa(l),e}function my(e,t,n){var r=3<arguments.length&&arguments[3]!==void 0?arguments[3]:null;return{$$typeof:Rn,key:r==null?null:""+r,children:e,containerInfo:t,implementation:n}}function $f(e){if(!e)return Xt;e=e._reactInternals;e:{if(xn(e)!==e||e.tag!==1)throw Error(j(170));var t=e;do{switch(t.tag){case 3:t=t.stateNode.context;break e;case 1:if(Me(t.type)){t=t.stateNode.__reactInternalMemoizedMergedChildContext;break e}}t=t.return}while(t!==null);throw Error(j(171))}if(e.tag===1){var n=e.type;if(Me(n))return Id(e,n,t)}return t}function Tf(e,t,n,r,o,l,i,a,u){return e=ja(n,r,!0,e,o,l,i,a,u),e.context=$f(null),n=e.current,r=Re(),o=Kt(n),l=Rt(r,o),l.callback=t??null,Qt(n,l,o),e.current.lanes=o,eo(e,o,r),Oe(e,r),e}function Tl(e,t,n,r){var o=t.current,l=Re(),i=Kt(o);return n=$f(n),t.context===null?t.context=n:t.pendingContext=n,t=Rt(l,i),t.payload={element:e},r=r===void 0?null:r,r!==null&&(t.callback=r),e=Qt(o,t,i),e!==null&&(ct(e,o,i,l),bo(e,o,i)),i}function fl(e){if(e=e.current,!e.child)return null;switch(e.child.tag){case 5:return e.child.stateNode;default:return e.child.stateNode}}function Zu(e,t){if(e=e.memoizedState,e!==null&&e.dehydrated!==null){var n=e.retryLane;e.retryLane=n!==0&&n<t?n:t}}function Ca(e,t){Zu(e,t),(e=e.alternate)&&Zu(e,t)}function hy(){return null}var bf=typeof reportError=="function"?reportError:function(e){console.error(e)};function Na(e){this._internalRoot=e}bl.prototype.render=Na.prototype.render=function(e){var t=this._internalRoot;if(t===null)throw Error(j(409));Tl(e,t,null,null)};bl.prototype.unmount=Na.prototype.unmount=function(){var e=this._internalRoot;if(e!==null){this._internalRoot=null;var t=e.containerInfo;_n(function(){Tl(null,e,null,null)}),t[Lt]=null}};function bl(e){this._internalRoot=e}bl.prototype.unstable_scheduleHydration=function(e){if(e){var t=cd();e={blockedOn:null,target:e,priority:t};for(var n=0;n<At.length&&t!==0&&t<At[n].priority;n++);At.splice(n,0,e),n===0&&fd(e)}};function Ra(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11)}function Ml(e){return!(!e||e.nodeType!==1&&e.nodeType!==9&&e.nodeType!==11&&(e.nodeType!==8||e.nodeValue!==" react-mount-point-unstable "))}function ec(){}function yy(e,t,n,r,o){if(o){if(typeof r=="function"){var l=r;r=function(){var c=fl(i);l.call(c)}}var i=Tf(t,r,e,0,null,!1,!1,"",ec);return e._reactRootContainer=i,e[Lt]=i.current,Dr(e.nodeType===8?e.parentNode:e),_n(),i}for(;o=e.lastChild;)e.removeChild(o);if(typeof r=="function"){var a=r;r=function(){var c=fl(u);a.call(c)}}var u=ja(e,0,!1,null,null,!1,!1,"",ec);return e._reactRootContainer=u,e[Lt]=u.current,Dr(e.nodeType===8?e.parentNode:e),_n(function(){Tl(t,u,n,r)}),u}function Ol(e,t,n,r,o){var l=n._reactRootContainer;if(l){var i=l;if(typeof o=="function"){var a=o;o=function(){var u=fl(i);a.call(u)}}Tl(t,i,e,o)}else i=yy(n,t,e,o,r);return fl(i)}ad=function(e){switch(e.tag){case 3:var t=e.stateNode;if(t.current.memoizedState.isDehydrated){var n=xr(t.pendingLanes);n!==0&&(qs(t,n|1),Oe(t,ce()),!(V&6)&&(Jn=ce()+500,tn()))}break;case 13:_n(function(){var r=It(e,1);if(r!==null){var o=Re();ct(r,e,1,o)}}),Ca(e,1)}};Ks=function(e){if(e.tag===13){var t=It(e,134217728);if(t!==null){var n=Re();ct(t,e,134217728,n)}Ca(e,134217728)}};ud=function(e){if(e.tag===13){var t=Kt(e),n=It(e,t);if(n!==null){var r=Re();ct(n,e,t,r)}Ca(e,t)}};cd=function(){return K};dd=function(e,t){var n=K;try{return K=e,t()}finally{K=n}};Zi=function(e,t,n){switch(t){case"input":if(Qi(e,n),t=n.name,n.type==="radio"&&t!=null){for(n=e;n.parentNode;)n=n.parentNode;for(n=n.querySelectorAll("input[name="+JSON.stringify(""+t)+'][type="radio"]'),t=0;t<n.length;t++){var r=n[t];if(r!==e&&r.form===e.form){var o=Cl(r);if(!o)throw Error(j(90));Uc(r),Qi(r,o)}}}break;case"textarea":Vc(e,n);break;case"select":t=n.value,t!=null&&Fn(e,!!n.multiple,t,!1)}};Xc=xa;Jc=_n;var gy={usingClientEntryPoint:!1,Events:[no,Tn,Cl,Gc,Yc,xa]},mr={findFiberByHostInstance:an,bundleType:0,version:"18.3.1",rendererPackageName:"react-dom"},vy={bundleType:mr.bundleType,version:mr.version,rendererPackageName:mr.rendererPackageName,rendererConfig:mr.rendererConfig,overrideHookState:null,overrideHookStateDeletePath:null,overrideHookStateRenamePath:null,overrideProps:null,overridePropsDeletePath:null,overridePropsRenamePath:null,setErrorHandler:null,setSuspenseHandler:null,scheduleUpdate:null,currentDispatcherRef:bt.ReactCurrentDispatcher,findHostInstanceByFiber:function(e){return e=td(e),e===null?null:e.stateNode},findFiberByHostInstance:mr.findFiberByHostInstance||hy,findHostInstancesForRefresh:null,scheduleRefresh:null,scheduleRoot:null,setRefreshHandler:null,getCurrentFiber:null,reconcilerVersion:"18.3.1-next-f1338f8080-20240426"};if(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__<"u"){var jo=__REACT_DEVTOOLS_GLOBAL_HOOK__;if(!jo.isDisabled&&jo.supportsFiber)try{Sl=jo.inject(vy),_t=jo}catch{}}We.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED=gy;We.createPortal=function(e,t){var n=2<arguments.length&&arguments[2]!==void 0?arguments[2]:null;if(!Ra(t))throw Error(j(200));return my(e,t,null,n)};We.createRoot=function(e,t){if(!Ra(e))throw Error(j(299));var n=!1,r="",o=bf;return t!=null&&(t.unstable_strictMode===!0&&(n=!0),t.identifierPrefix!==void 0&&(r=t.identifierPrefix),t.onRecoverableError!==void 0&&(o=t.onRecoverableError)),t=ja(e,1,!1,null,null,n,!1,r,o),e[Lt]=t.current,Dr(e.nodeType===8?e.parentNode:e),new Na(t)};We.findDOMNode=function(e){if(e==null)return null;if(e.nodeType===1)return e;var t=e._reactInternals;if(t===void 0)throw typeof e.render=="function"?Error(j(188)):(e=Object.keys(e).join(","),Error(j(268,e)));return e=td(t),e=e===null?null:e.stateNode,e};We.flushSync=function(e){return _n(e)};We.hydrate=function(e,t,n){if(!Ml(t))throw Error(j(200));return Ol(null,e,t,!0,n)};We.hydrateRoot=function(e,t,n){if(!Ra(e))throw Error(j(405));var r=n!=null&&n.hydratedSources||null,o=!1,l="",i=bf;if(n!=null&&(n.unstable_strictMode===!0&&(o=!0),n.identifierPrefix!==void 0&&(l=n.identifierPrefix),n.onRecoverableError!==void 0&&(i=n.onRecoverableError)),t=Tf(t,null,e,1,n??null,o,!1,l,i),e[Lt]=t.current,Dr(e),r)for(e=0;e<r.length;e++)n=r[e],o=n._getVersion,o=o(n._source),t.mutableSourceEagerHydrationData==null?t.mutableSourceEagerHydrationData=[n,o]:t.mutableSourceEagerHydrationData.push(n,o);return new bl(t)};We.render=function(e,t,n){if(!Ml(t))throw Error(j(200));return Ol(null,e,t,!1,n)};We.unmountComponentAtNode=function(e){if(!Ml(e))throw Error(j(40));return e._reactRootContainer?(_n(function(){Ol(null,null,e,!1,function(){e._reactRootContainer=null,e[Lt]=null})}),!0):!1};We.unstable_batchedUpdates=xa;We.unstable_renderSubtreeIntoContainer=function(e,t,n,r){if(!Ml(n))throw Error(j(200));if(e==null||e._reactInternals===void 0)throw Error(j(38));return Ol(e,t,n,!1,r)};We.version="18.3.1-next-f1338f8080-20240426";function Mf(){if(!(typeof __REACT_DEVTOOLS_GLOBAL_HOOK__>"u"||typeof __REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE!="function"))try{__REACT_DEVTOOLS_GLOBAL_HOOK__.checkDCE(Mf)}catch(e){console.error(e)}}Mf(),bc.exports=We;var Of=bc.exports,tc=Of;Bi.createRoot=tc.createRoot,Bi.hydrateRoot=tc.hydrateRoot;/**
 * react-router v7.18.0
 *
 * Copyright (c) Remix Software Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE.md file in the root directory of this source tree.
 *
 * @license MIT
 */var Pa=/^(?:[a-z][a-z0-9+.-]*:|[\\/]{2})/i,zf=/^[\\/]{2}/;function _y(e,t){return t+e.replace(/\\/g,"/")}var nc="popstate";function rc(e){return typeof e=="object"&&e!=null&&"pathname"in e&&"search"in e&&"hash"in e&&"state"in e&&"key"in e}function wy(e={}){function t(r,o){var c;let l=(c=o.state)==null?void 0:c.masked,{pathname:i,search:a,hash:u}=l||r.location;return $s("",{pathname:i,search:a,hash:u},o.state&&o.state.usr||null,o.state&&o.state.key||"default",l?{pathname:r.location.pathname,search:r.location.search,hash:r.location.hash}:void 0)}function n(r,o){return typeof o=="string"?o:Yr(o)}return Sy(t,n,null,e)}function le(e,t){if(e===!1||e===null||typeof e>"u")throw new Error(t)}function xt(e,t){if(!e){typeof console<"u"&&console.warn(t);try{throw new Error(t)}catch{}}}function xy(){return Math.random().toString(36).substring(2,10)}function oc(e,t){return{usr:e.state,key:e.key,idx:t,masked:e.mask?{pathname:e.pathname,search:e.search,hash:e.hash}:void 0}}function $s(e,t,n=null,r,o){return{pathname:typeof e=="string"?e:e.pathname,search:"",hash:"",...typeof t=="string"?rr(t):t,state:n,key:t&&t.key||r||xy(),mask:o}}function Yr({pathname:e="/",search:t="",hash:n=""}){return t&&t!=="?"&&(e+=t.charAt(0)==="?"?t:"?"+t),n&&n!=="#"&&(e+=n.charAt(0)==="#"?n:"#"+n),e}function rr(e){let t={};if(e){let n=e.indexOf("#");n>=0&&(t.hash=e.substring(n),e=e.substring(0,n));let r=e.indexOf("?");r>=0&&(t.search=e.substring(r),e=e.substring(0,r)),e&&(t.pathname=e)}return t}function Sy(e,t,n,r={}){let{window:o=document.defaultView,v5Compat:l=!1}=r,i=o.history,a="POP",u=null,c=d();c==null&&(c=0,i.replaceState({...i.state,idx:c},""));function d(){return(i.state||{idx:null}).idx}function f(){a="POP";let S=d(),p=S==null?null:S-c;c=S,u&&u({action:a,location:v.location,delta:p})}function h(S,p){a="PUSH";let m=rc(S)?S:$s(v.location,S,p);c=d()+1;let y=oc(m,c),x=v.createHref(m.mask||m);try{i.pushState(y,"",x)}catch(k){if(k instanceof DOMException&&k.name==="DataCloneError")throw k;o.location.assign(x)}l&&u&&u({action:a,location:v.location,delta:1})}function _(S,p){a="REPLACE";let m=rc(S)?S:$s(v.location,S,p);c=d();let y=oc(m,c),x=v.createHref(m.mask||m);i.replaceState(y,"",x),l&&u&&u({action:a,location:v.location,delta:0})}function w(S){return ky(o,S)}let v={get action(){return a},get location(){return e(o,i)},listen(S){if(u)throw new Error("A history only accepts one active listener");return o.addEventListener(nc,f),u=S,()=>{o.removeEventListener(nc,f),u=null}},createHref(S){return t(o,S)},createURL:w,encodeLocation(S){let p=w(S);return{pathname:p.pathname,search:p.search,hash:p.hash}},push:h,replace:_,go(S){return i.go(S)}};return v}function ky(e,t,n=!1){let r="http://localhost";e&&(r=e.location.origin!=="null"?e.location.origin:e.location.href),le(r,"No window.location.(origin|href) available to create URL");let o=typeof t=="string"?t:Yr(t);return o=o.replace(/ $/,"%20"),!n&&zf.test(o)&&(o=r+o),new URL(o,r)}function Af(e,t,n="/"){return Ey(e,t,n,!1)}function Ey(e,t,n,r,o){let l=typeof t=="string"?rr(t):t,i=Tt(l.pathname||"/",n);if(i==null)return null;let a=jy(e),u=null,c=Oy(i);for(let d=0;u==null&&d<a.length;++d)u=My(a[d],c,r);return u}function jy(e){let t=Bf(e);return Cy(t),t}function Bf(e,t=[],n=[],r="",o=!1){let l=(i,a,u=o,c)=>{let d={relativePath:c===void 0?i.path||"":c,caseSensitive:i.caseSensitive===!0,childrenIndex:a,route:i};if(d.relativePath.startsWith("/")){if(!d.relativePath.startsWith(r)&&u)return;le(d.relativePath.startsWith(r),`Absolute route path "${d.relativePath}" nested under path "${r}" is not valid. An absolute child route path must start with the combined path of all its parent routes.`),d.relativePath=d.relativePath.slice(r.length)}let f=dt([r,d.relativePath]),h=n.concat(d);i.children&&i.children.length>0&&(le(i.index!==!0,`Index routes must not have child routes. Please remove all child routes from route path "${f}".`),Bf(i.children,t,h,f,u)),!(i.path==null&&!i.index)&&t.push({path:f,score:Ty(f,i.index),routesMeta:h.map((_,w)=>{let[v,S]=Uf(_.relativePath,_.caseSensitive,w===h.length-1);return{..._,matcher:v,compiledParams:S}})})};return e.forEach((i,a)=>{var u;if(i.path===""||!((u=i.path)!=null&&u.includes("?")))l(i,a);else for(let c of Ff(i.path))l(i,a,!0,c)}),t}function Ff(e){let t=e.split("/");if(t.length===0)return[];let[n,...r]=t,o=n.endsWith("?"),l=n.replace(/\?$/,"");if(r.length===0)return o?[l,""]:[l];let i=Ff(r.join("/")),a=[];return a.push(...i.map(u=>u===""?l:[l,u].join("/"))),o&&a.push(...i),a.map(u=>e.startsWith("/")&&u===""?"/":u)}function Cy(e){e.sort((t,n)=>t.score!==n.score?n.score-t.score:by(t.routesMeta.map(r=>r.childrenIndex),n.routesMeta.map(r=>r.childrenIndex)))}var Ny=/^:[\w-]+$/,Ry=3,Py=2,Ly=1,Iy=10,$y=-2,lc=e=>e==="*";function Ty(e,t){let n=e.split("/"),r=n.length;return n.some(lc)&&(r+=$y),t&&(r+=Py),n.filter(o=>!lc(o)).reduce((o,l)=>o+(Ny.test(l)?Ry:l===""?Ly:Iy),r)}function by(e,t){return e.length===t.length&&e.slice(0,-1).every((r,o)=>r===t[o])?e[e.length-1]-t[t.length-1]:0}function My(e,t,n=!1){let{routesMeta:r}=e,o={},l="/",i=[];for(let a=0;a<r.length;++a){let u=r[a],c=a===r.length-1,d=l==="/"?t:t.slice(l.length)||"/",f={path:u.relativePath,caseSensitive:u.caseSensitive,end:c},h=u.matcher&&u.compiledParams?Df(f,d,u.matcher,u.compiledParams):pl(f,d),_=u.route;if(!h&&c&&n&&!r[r.length-1].route.index&&(h=pl({path:u.relativePath,caseSensitive:u.caseSensitive,end:!1},d)),!h)return null;Object.assign(o,h.params),i.push({params:o,pathname:dt([l,h.pathname]),pathnameBase:By(dt([l,h.pathnameBase])),route:_}),h.pathnameBase!=="/"&&(l=dt([l,h.pathnameBase]))}return i}function pl(e,t){typeof e=="string"&&(e={path:e,caseSensitive:!1,end:!0});let[n,r]=Uf(e.path,e.caseSensitive,e.end);return Df(e,t,n,r)}function Df(e,t,n,r){let o=t.match(n);if(!o)return null;let l=o[0],i=l.replace(/(.)\/+$/,"$1"),a=o.slice(1);return{params:r.reduce((c,{paramName:d,isOptional:f},h)=>{if(d==="*"){let w=a[h]||"";i=l.slice(0,l.length-w.length).replace(/(.)\/+$/,"$1")}const _=a[h];return f&&!_?c[d]=void 0:c[d]=(_||"").replace(/%2F/g,"/"),c},{}),pathname:l,pathnameBase:i,pattern:e}}function Uf(e,t=!1,n=!0){xt(e==="*"||!e.endsWith("*")||e.endsWith("/*"),`Route path "${e}" will be treated as if it were "${e.replace(/\*$/,"/*")}" because the \`*\` character must always follow a \`/\` in the pattern. To get rid of this warning, please change the route path to "${e.replace(/\*$/,"/*")}".`);let r=[],o="^"+e.replace(/\/*\*?$/,"").replace(/^\/*/,"/").replace(/[\\.*+^${}|()[\]]/g,"\\$&").replace(/\/:([\w-]+)(\?)?/g,(i,a,u,c,d)=>{if(r.push({paramName:a,isOptional:u!=null}),u){let f=d.charAt(c+i.length);return f&&f!=="/"?"/([^\\/]*)":"(?:/([^\\/]*))?"}return"/([^\\/]+)"}).replace(/\/([\w-]+)\?(\/|$)/g,"(/$1)?$2");return e.endsWith("*")?(r.push({paramName:"*"}),o+=e==="*"||e==="/*"?"(.*)$":"(?:\\/(.+)|\\/*)$"):n?o+="\\/*$":e!==""&&e!=="/"&&(o+="(?:(?=\\/|$))"),[new RegExp(o,t?void 0:"i"),r]}function Oy(e){try{return e.split("/").map(t=>decodeURIComponent(t).replace(/\//g,"%2F")).join("/")}catch(t){return xt(!1,`The URL path "${e}" could not be decoded because it is a malformed URL segment. This is probably due to a bad percent encoding (${t}).`),e}}function Tt(e,t){if(t==="/")return e;if(!e.toLowerCase().startsWith(t.toLowerCase()))return null;let n=t.endsWith("/")?t.length-1:t.length,r=e.charAt(n);return r&&r!=="/"?null:e.slice(n)||"/"}function zy(e,t="/"){let{pathname:n,search:r="",hash:o=""}=typeof e=="string"?rr(e):e,l;return n?(n=Vf(n),n.startsWith("/")?l=ic(n.substring(1),"/"):l=ic(n,t)):l=t,{pathname:l,search:Fy(r),hash:Dy(o)}}function ic(e,t){let n=ml(t).split("/");return e.split("/").forEach(o=>{o===".."?n.length>1&&n.pop():o!=="."&&n.push(o)}),n.length>1?n.join("/"):"/"}function Ti(e,t,n,r){return`Cannot include a '${e}' character in a manually specified \`to.${t}\` field [${JSON.stringify(r)}].  Please separate it out to the \`to.${n}\` field. Alternatively you may provide the full path as a string in <Link to="..."> and the router will parse it for you.`}function Ay(e){return e.filter((t,n)=>n===0||t.route.path&&t.route.path.length>0)}function Hf(e){let t=Ay(e);return t.map((n,r)=>r===t.length-1?n.pathname:n.pathnameBase)}function La(e,t,n,r=!1){let o;typeof e=="string"?o=rr(e):(o={...e},le(!o.pathname||!o.pathname.includes("?"),Ti("?","pathname","search",o)),le(!o.pathname||!o.pathname.includes("#"),Ti("#","pathname","hash",o)),le(!o.search||!o.search.includes("#"),Ti("#","search","hash",o)));let l=e===""||o.pathname==="",i=l?"/":o.pathname,a;if(i==null)a=n;else{let f=t.length-1;if(!r&&i.startsWith("..")){let h=i.split("/");for(;h[0]==="..";)h.shift(),f-=1;o.pathname=h.join("/")}a=f>=0?t[f]:"/"}let u=zy(o,a),c=i&&i!=="/"&&i.endsWith("/"),d=(l||i===".")&&n.endsWith("/");return!u.pathname.endsWith("/")&&(c||d)&&(u.pathname+="/"),u}var Vf=e=>e.replace(/[\\/]{2,}/g,"/"),dt=e=>Vf(e.join("/")),ml=e=>e.replace(/\/+$/,""),By=e=>ml(e).replace(/^\/*/,"/"),Fy=e=>!e||e==="?"?"":e.startsWith("?")?e:"?"+e,Dy=e=>!e||e==="#"?"":e.startsWith("#")?e:"#"+e,Uy=class{constructor(e,t,n,r=!1){this.status=e,this.statusText=t||"",this.internal=r,n instanceof Error?(this.data=n.toString(),this.error=n):this.data=n}};function Hy(e){return e!=null&&typeof e.status=="number"&&typeof e.statusText=="string"&&typeof e.internal=="boolean"&&"data"in e}function Vy(e){let t=e.map(n=>n.route.path).filter(Boolean);return dt(t)||"/"}var Wf=typeof window<"u"&&typeof window.document<"u"&&typeof window.document.createElement<"u";function Qf(e,t){let n=e;if(typeof n!="string"||!Pa.test(n))return{absoluteURL:void 0,isExternal:!1,to:n};let r=n,o=!1;if(Wf)try{let l=new URL(window.location.href),i=zf.test(n)?new URL(_y(n,l.protocol)):new URL(n),a=Tt(i.pathname,t);i.origin===l.origin&&a!=null?n=a+i.search+i.hash:o=!0}catch{xt(!1,`<Link to="${n}"> contains an invalid URL which will probably break when clicked - please update to a valid URL path.`)}return{absoluteURL:r,isExternal:o,to:n}}Object.getOwnPropertyNames(Object.prototype).sort().join("\0");var qf=["POST","PUT","PATCH","DELETE"];new Set(qf);var Wy=["GET",...qf];new Set(Wy);var Qy=["about:","blob:","chrome:","chrome-untrusted:","content:","data:","devtools:","file:","filesystem:","javascript:"];function qy(e){try{return Qy.includes(new URL(e).protocol)}catch{return!1}}var or=g.createContext(null);or.displayName="DataRouter";var zl=g.createContext(null);zl.displayName="DataRouterState";var Kf=g.createContext(!1);function Ky(){return g.useContext(Kf)}var Gf=g.createContext({isTransitioning:!1});Gf.displayName="ViewTransition";var Gy=g.createContext(new Map);Gy.displayName="Fetchers";var Yy=g.createContext(null);Yy.displayName="Await";var et=g.createContext(null);et.displayName="Navigation";var oo=g.createContext(null);oo.displayName="Location";var St=g.createContext({outlet:null,matches:[],isDataRoute:!1});St.displayName="Route";var Ia=g.createContext(null);Ia.displayName="RouteError";var Yf="REACT_ROUTER_ERROR",Xy="REDIRECT",Jy="ROUTE_ERROR_RESPONSE";function Zy(e){if(e.startsWith(`${Yf}:${Xy}:{`))try{let t=JSON.parse(e.slice(28));if(typeof t=="object"&&t&&typeof t.status=="number"&&typeof t.statusText=="string"&&typeof t.location=="string"&&typeof t.reloadDocument=="boolean"&&typeof t.replace=="boolean")return t}catch{}}function eg(e){if(e.startsWith(`${Yf}:${Jy}:{`))try{let t=JSON.parse(e.slice(40));if(typeof t=="object"&&t&&typeof t.status=="number"&&typeof t.statusText=="string")return new Uy(t.status,t.statusText,t.data)}catch{}}function tg(e,{relative:t}={}){le(lo(),"useHref() may be used only in the context of a <Router> component.");let{basename:n,navigator:r}=g.useContext(et),{hash:o,pathname:l,search:i}=io(e,{relative:t}),a=l;return n!=="/"&&(a=l==="/"?n:dt([n,l])),r.createHref({pathname:a,search:i,hash:o})}function lo(){return g.useContext(oo)!=null}function kt(){return le(lo(),"useLocation() may be used only in the context of a <Router> component."),g.useContext(oo).location}var Xf="You should call navigate() in a React.useEffect(), not when your component is first rendered.";function Jf(e){g.useContext(et).static||g.useLayoutEffect(e)}function Zf(){let{isDataRoute:e}=g.useContext(St);return e?hg():ng()}function ng(){le(lo(),"useNavigate() may be used only in the context of a <Router> component.");let e=g.useContext(or),{basename:t,navigator:n}=g.useContext(et),{matches:r}=g.useContext(St),{pathname:o}=kt(),l=JSON.stringify(Hf(r)),i=g.useRef(!1);return Jf(()=>{i.current=!0}),g.useCallback((u,c={})=>{if(xt(i.current,Xf),!i.current)return;if(typeof u=="number"){n.go(u);return}let d=La(u,JSON.parse(l),o,c.relative==="path");e==null&&t!=="/"&&(d.pathname=d.pathname==="/"?t:dt([t,d.pathname])),(c.replace?n.replace:n.push)(d,c.state,c)},[t,n,l,o,e])}g.createContext(null);function rg(){let{matches:e}=g.useContext(St),t=e[e.length-1];return(t==null?void 0:t.params)??{}}function io(e,{relative:t}={}){let{matches:n}=g.useContext(St),{pathname:r}=kt(),o=JSON.stringify(Hf(n));return g.useMemo(()=>La(e,JSON.parse(o),r,t==="path"),[e,o,r,t])}function og(e,t){return ep(e,t)}function ep(e,t,n){var S;le(lo(),"useRoutes() may be used only in the context of a <Router> component.");let{navigator:r}=g.useContext(et),{matches:o}=g.useContext(St),l=o[o.length-1],i=l?l.params:{},a=l?l.pathname:"/",u=l?l.pathnameBase:"/",c=l&&l.route;{let p=c&&c.path||"";np(a,!c||p.endsWith("*")||p.endsWith("*?"),`You rendered descendant <Routes> (or called \`useRoutes()\`) at "${a}" (under <Route path="${p}">) but the parent route path has no trailing "*". This means if you navigate deeper, the parent won't match anymore and therefore the child routes will never render.

Please change the parent <Route path="${p}"> to <Route path="${p==="/"?"*":`${p}/*`}">.`)}let d=kt(),f;if(t){let p=typeof t=="string"?rr(t):t;le(u==="/"||((S=p.pathname)==null?void 0:S.startsWith(u)),`When overriding the location using \`<Routes location>\` or \`useRoutes(routes, location)\`, the location pathname must begin with the portion of the URL pathname that was matched by all parent routes. The current pathname base is "${u}" but pathname "${p.pathname}" was given in the \`location\` prop.`),f=p}else f=d;let h=f.pathname||"/",_=h;if(u!=="/"){let p=u.replace(/^\//,"").split("/");_="/"+h.replace(/^\//,"").split("/").slice(p.length).join("/")}let w=n&&n.state.matches.length?n.state.matches.map(p=>Object.assign(p,{route:n.manifest[p.route.id]||p.route})):Af(e,{pathname:_});xt(c||w!=null,`No routes matched location "${f.pathname}${f.search}${f.hash}" `),xt(w==null||w[w.length-1].route.element!==void 0||w[w.length-1].route.Component!==void 0||w[w.length-1].route.lazy!==void 0,`Matched leaf route at location "${f.pathname}${f.search}${f.hash}" does not have an element or Component. This means it will render an <Outlet /> with a null value by default resulting in an "empty" page.`);let v=ug(w&&w.map(p=>Object.assign({},p,{params:Object.assign({},i,p.params),pathname:dt([u,r.encodeLocation?r.encodeLocation(p.pathname.replace(/%/g,"%25").replace(/\?/g,"%3F").replace(/#/g,"%23")).pathname:p.pathname]),pathnameBase:p.pathnameBase==="/"?u:dt([u,r.encodeLocation?r.encodeLocation(p.pathnameBase.replace(/%/g,"%25").replace(/\?/g,"%3F").replace(/#/g,"%23")).pathname:p.pathnameBase])})),o,n);return t&&v?g.createElement(oo.Provider,{value:{location:{pathname:"/",search:"",hash:"",state:null,key:"default",mask:void 0,...f},navigationType:"POP"}},v):v}function lg(){let e=mg(),t=Hy(e)?`${e.status} ${e.statusText}`:e instanceof Error?e.message:JSON.stringify(e),n=e instanceof Error?e.stack:null,r="rgba(200,200,200, 0.5)",o={padding:"0.5rem",backgroundColor:r},l={padding:"2px 4px",backgroundColor:r},i=null;return console.error("Error handled by React Router default ErrorBoundary:",e),i=g.createElement(g.Fragment,null,g.createElement("p",null,"💿 Hey developer 👋"),g.createElement("p",null,"You can provide a way better UX than this when your app throws errors by providing your own ",g.createElement("code",{style:l},"ErrorBoundary")," or"," ",g.createElement("code",{style:l},"errorElement")," prop on your route.")),g.createElement(g.Fragment,null,g.createElement("h2",null,"Unexpected Application Error!"),g.createElement("h3",{style:{fontStyle:"italic"}},t),n?g.createElement("pre",{style:o},n):null,i)}var ig=g.createElement(lg,null),tp=class extends g.Component{constructor(e){super(e),this.state={location:e.location,revalidation:e.revalidation,error:e.error}}static getDerivedStateFromError(e){return{error:e}}static getDerivedStateFromProps(e,t){return t.location!==e.location||t.revalidation!=="idle"&&e.revalidation==="idle"?{error:e.error,location:e.location,revalidation:e.revalidation}:{error:e.error!==void 0?e.error:t.error,location:t.location,revalidation:e.revalidation||t.revalidation}}componentDidCatch(e,t){this.props.onError?this.props.onError(e,t):console.error("React Router caught the following error during render",e)}render(){let e=this.state.error;if(this.context&&typeof e=="object"&&e&&"digest"in e&&typeof e.digest=="string"){const n=eg(e.digest);n&&(e=n)}let t=e!==void 0?g.createElement(St.Provider,{value:this.props.routeContext},g.createElement(Ia.Provider,{value:e,children:this.props.component})):this.props.children;return this.context?g.createElement(sg,{error:e},t):t}};tp.contextType=Kf;var bi=new WeakMap;function sg({children:e,error:t}){let{basename:n}=g.useContext(et);if(typeof t=="object"&&t&&"digest"in t&&typeof t.digest=="string"){let r=Zy(t.digest);if(r){let o=bi.get(t);if(o)throw o;let l=Qf(r.location,n),i=l.absoluteURL||l.to;if(qy(i))throw new Error("Invalid redirect location");if(Wf&&!bi.get(t))if(l.isExternal||r.reloadDocument)window.location.href=i;else{const a=Promise.resolve().then(()=>window.__reactRouterDataRouter.navigate(l.to,{replace:r.replace}));throw bi.set(t,a),a}return g.createElement("meta",{httpEquiv:"refresh",content:`0;url=${i}`})}}return e}function ag({routeContext:e,match:t,children:n}){let r=g.useContext(or);return r&&r.static&&r.staticContext&&(t.route.errorElement||t.route.ErrorBoundary)&&(r.staticContext._deepestRenderedBoundaryId=t.route.id),g.createElement(St.Provider,{value:e},n)}function ug(e,t=[],n){let r=n==null?void 0:n.state;if(e==null){if(!r)return null;if(r.errors)e=r.matches;else if(t.length===0&&!r.initialized&&r.matches.length>0)e=r.matches;else return null}let o=e,l=r==null?void 0:r.errors;if(l!=null){let d=o.findIndex(f=>f.route.id&&(l==null?void 0:l[f.route.id])!==void 0);le(d>=0,`Could not find a matching route for errors on route IDs: ${Object.keys(l).join(",")}`),o=o.slice(0,Math.min(o.length,d+1))}let i=!1,a=-1;if(n&&r){i=r.renderFallback;for(let d=0;d<o.length;d++){let f=o[d];if((f.route.HydrateFallback||f.route.hydrateFallbackElement)&&(a=d),f.route.id){let{loaderData:h,errors:_}=r,w=f.route.loader&&!h.hasOwnProperty(f.route.id)&&(!_||_[f.route.id]===void 0);if(f.route.lazy||w){n.isStatic&&(i=!0),a>=0?o=o.slice(0,a+1):o=[o[0]];break}}}}let u=n==null?void 0:n.onError,c=r&&u?(d,f)=>{var h,_;u(d,{location:r.location,params:((_=(h=r.matches)==null?void 0:h[0])==null?void 0:_.params)??{},pattern:Vy(r.matches),errorInfo:f})}:void 0;return o.reduceRight((d,f,h)=>{let _,w=!1,v=null,S=null;r&&(_=l&&f.route.id?l[f.route.id]:void 0,v=f.route.errorElement||ig,i&&(a<0&&h===0?(np("route-fallback",!1,"No `HydrateFallback` element provided to render during initial hydration"),w=!0,S=null):a===h&&(w=!0,S=f.route.hydrateFallbackElement||null)));let p=t.concat(o.slice(0,h+1)),m=()=>{let y;return _?y=v:w?y=S:f.route.Component?y=g.createElement(f.route.Component,null):f.route.element?y=f.route.element:y=d,g.createElement(ag,{match:f,routeContext:{outlet:d,matches:p,isDataRoute:r!=null},children:y})};return r&&(f.route.ErrorBoundary||f.route.errorElement||h===0)?g.createElement(tp,{location:r.location,revalidation:r.revalidation,component:v,error:_,children:m(),routeContext:{outlet:null,matches:p,isDataRoute:!0},onError:c}):m()},null)}function $a(e){return`${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`}function cg(e){let t=g.useContext(or);return le(t,$a(e)),t}function dg(e){let t=g.useContext(zl);return le(t,$a(e)),t}function fg(e){let t=g.useContext(St);return le(t,$a(e)),t}function Ta(e){let t=fg(e),n=t.matches[t.matches.length-1];return le(n.route.id,`${e} can only be used on routes that contain a unique "id"`),n.route.id}function pg(){return Ta("useRouteId")}function mg(){var r;let e=g.useContext(Ia),t=dg("useRouteError"),n=Ta("useRouteError");return e!==void 0?e:(r=t.errors)==null?void 0:r[n]}function hg(){let{router:e}=cg("useNavigate"),t=Ta("useNavigate"),n=g.useRef(!1);return Jf(()=>{n.current=!0}),g.useCallback(async(o,l={})=>{xt(n.current,Xf),n.current&&(typeof o=="number"?await e.navigate(o):await e.navigate(o,{fromRouteId:t,...l}))},[e,t])}var sc={};function np(e,t,n){!t&&!sc[e]&&(sc[e]=!0,xt(!1,n))}g.memo(yg);function yg({routes:e,manifest:t,future:n,state:r,isStatic:o,onError:l}){return ep(e,void 0,{manifest:t,state:r,isStatic:o,onError:l})}function kr(e){le(!1,"A <Route> is only ever to be used as the child of <Routes> element, never rendered directly. Please wrap your <Route> in a <Routes>.")}function gg({basename:e="/",children:t=null,location:n,navigationType:r="POP",navigator:o,static:l=!1,useTransitions:i}){le(!lo(),"You cannot render a <Router> inside another <Router>. You should never have more than one in your app.");let a=e.replace(/^\/*/,"/"),u=g.useMemo(()=>({basename:a,navigator:o,static:l,useTransitions:i,future:{}}),[a,o,l,i]);typeof n=="string"&&(n=rr(n));let{pathname:c="/",search:d="",hash:f="",state:h=null,key:_="default",mask:w}=n,v=g.useMemo(()=>{let S=Tt(c,a);return S==null?null:{location:{pathname:S,search:d,hash:f,state:h,key:_,mask:w},navigationType:r}},[a,c,d,f,h,_,r,w]);return xt(v!=null,`<Router basename="${a}"> is not able to match the URL "${c}${d}${f}" because it does not start with the basename, so the <Router> won't render anything.`),v==null?null:g.createElement(et.Provider,{value:u},g.createElement(oo.Provider,{children:t,value:v}))}function vg({children:e,location:t}){return og(Ts(e),t)}function Ts(e,t=[]){let n=[];return g.Children.forEach(e,(r,o)=>{if(!g.isValidElement(r))return;let l=[...t,o];if(r.type===g.Fragment){n.push.apply(n,Ts(r.props.children,l));return}le(r.type===kr,`[${typeof r.type=="string"?r.type:r.type.name}] is not a <Route> component. All component children of <Routes> must be a <Route> or <React.Fragment>`),le(!r.props.index||!r.props.children,"An index route cannot have child routes.");let i={id:r.props.id||l.join("-"),caseSensitive:r.props.caseSensitive,element:r.props.element,Component:r.props.Component,index:r.props.index,path:r.props.path,middleware:r.props.middleware,loader:r.props.loader,action:r.props.action,hydrateFallbackElement:r.props.hydrateFallbackElement,HydrateFallback:r.props.HydrateFallback,errorElement:r.props.errorElement,ErrorBoundary:r.props.ErrorBoundary,hasErrorBoundary:r.props.hasErrorBoundary===!0||r.props.ErrorBoundary!=null||r.props.errorElement!=null,shouldRevalidate:r.props.shouldRevalidate,handle:r.props.handle,lazy:r.props.lazy};r.props.children&&(i.children=Ts(r.props.children,l)),n.push(i)}),n}var Do="get",Uo="application/x-www-form-urlencoded";function Al(e){return typeof HTMLElement<"u"&&e instanceof HTMLElement}function _g(e){return Al(e)&&e.tagName.toLowerCase()==="button"}function wg(e){return Al(e)&&e.tagName.toLowerCase()==="form"}function xg(e){return Al(e)&&e.tagName.toLowerCase()==="input"}function Sg(e){return!!(e.metaKey||e.altKey||e.ctrlKey||e.shiftKey)}function kg(e,t){return e.button===0&&(!t||t==="_self")&&!Sg(e)}var Co=null;function Eg(){if(Co===null)try{new FormData(document.createElement("form"),0),Co=!1}catch{Co=!0}return Co}var jg=new Set(["application/x-www-form-urlencoded","multipart/form-data","text/plain"]);function Mi(e){return e!=null&&!jg.has(e)?(xt(!1,`"${e}" is not a valid \`encType\` for \`<Form>\`/\`<fetcher.Form>\` and will default to "${Uo}"`),null):e}function Cg(e,t){let n,r,o,l,i;if(wg(e)){let a=e.getAttribute("action");r=a?Tt(a,t):null,n=e.getAttribute("method")||Do,o=Mi(e.getAttribute("enctype"))||Uo,l=new FormData(e)}else if(_g(e)||xg(e)&&(e.type==="submit"||e.type==="image")){let a=e.form;if(a==null)throw new Error('Cannot submit a <button> or <input type="submit"> without a <form>');let u=e.getAttribute("formaction")||a.getAttribute("action");if(r=u?Tt(u,t):null,n=e.getAttribute("formmethod")||a.getAttribute("method")||Do,o=Mi(e.getAttribute("formenctype"))||Mi(a.getAttribute("enctype"))||Uo,l=new FormData(a,e),!Eg()){let{name:c,type:d,value:f}=e;if(d==="image"){let h=c?`${c}.`:"";l.append(`${h}x`,"0"),l.append(`${h}y`,"0")}else c&&l.append(c,f)}}else{if(Al(e))throw new Error('Cannot submit element that is not <form>, <button>, or <input type="submit|image">');n=Do,r=null,o=Uo,i=e}return l&&o==="text/plain"&&(i=l,l=void 0),{action:r,method:n.toLowerCase(),encType:o,formData:l,body:i}}Object.getOwnPropertyNames(Object.prototype).sort().join("\0");function ba(e,t){if(e===!1||e===null||typeof e>"u")throw new Error(t)}function rp(e,t,n,r){let o=typeof e=="string"?new URL(e,typeof window>"u"?"server://singlefetch/":window.location.origin):e;return n?o.pathname.endsWith("/")?o.pathname=`${o.pathname}_.${r}`:o.pathname=`${o.pathname}.${r}`:o.pathname==="/"?o.pathname=`_root.${r}`:t&&Tt(o.pathname,t)==="/"?o.pathname=`${ml(t)}/_root.${r}`:o.pathname=`${ml(o.pathname)}.${r}`,o}async function Ng(e,t){if(e.id in t)return t[e.id];try{let n=await import(e.module);return t[e.id]=n,n}catch(n){return console.error(`Error loading route module \`${e.module}\`, reloading page...`),console.error(n),window.__reactRouterContext&&window.__reactRouterContext.isSpaMode,window.location.reload(),new Promise(()=>{})}}function Rg(e){return e==null?!1:e.href==null?e.rel==="preload"&&typeof e.imageSrcSet=="string"&&typeof e.imageSizes=="string":typeof e.rel=="string"&&typeof e.href=="string"}async function Pg(e,t,n){let r=await Promise.all(e.map(async o=>{let l=t.routes[o.route.id];if(l){let i=await Ng(l,n);return i.links?i.links():[]}return[]}));return Tg(r.flat(1).filter(Rg).filter(o=>o.rel==="stylesheet"||o.rel==="preload").map(o=>o.rel==="stylesheet"?{...o,rel:"prefetch",as:"style"}:{...o,rel:"prefetch"}))}function ac(e,t,n,r,o,l){let i=(u,c)=>n[c]?u.route.id!==n[c].route.id:!0,a=(u,c)=>{var d;return n[c].pathname!==u.pathname||((d=n[c].route.path)==null?void 0:d.endsWith("*"))&&n[c].params["*"]!==u.params["*"]};return l==="assets"?t.filter((u,c)=>i(u,c)||a(u,c)):l==="data"?t.filter((u,c)=>{var f;let d=r.routes[u.route.id];if(!d||!d.hasLoader)return!1;if(i(u,c)||a(u,c))return!0;if(u.route.shouldRevalidate){let h=u.route.shouldRevalidate({currentUrl:new URL(o.pathname+o.search+o.hash,window.origin),currentParams:((f=n[0])==null?void 0:f.params)||{},nextUrl:new URL(e,window.origin),nextParams:u.params,defaultShouldRevalidate:!0});if(typeof h=="boolean")return h}return!0}):[]}function Lg(e,t,{includeHydrateFallback:n}={}){return Ig(e.map(r=>{let o=t.routes[r.route.id];if(!o)return[];let l=[o.module];return o.clientActionModule&&(l=l.concat(o.clientActionModule)),o.clientLoaderModule&&(l=l.concat(o.clientLoaderModule)),n&&o.hydrateFallbackModule&&(l=l.concat(o.hydrateFallbackModule)),o.imports&&(l=l.concat(o.imports)),l}).flat(1))}function Ig(e){return[...new Set(e)]}function $g(e){let t={},n=Object.keys(e).sort();for(let r of n)t[r]=e[r];return t}function Tg(e,t){let n=new Set;return new Set(t),e.reduce((r,o)=>{let l=JSON.stringify($g(o));return n.has(l)||(n.add(l),r.push({key:l,link:o})),r},[])}function Ma(){let e=g.useContext(or);return ba(e,"You must render this element inside a <DataRouterContext.Provider> element"),e}function bg(){let e=g.useContext(zl);return ba(e,"You must render this element inside a <DataRouterStateContext.Provider> element"),e}var Oa=g.createContext(void 0);Oa.displayName="FrameworkContext";function Bl(){let e=g.useContext(Oa);return ba(e,"You must render this element inside a <HydratedRouter> element"),e}function Mg(e,t){let n=g.useContext(Oa),[r,o]=g.useState(!1),[l,i]=g.useState(!1),{onFocus:a,onBlur:u,onMouseEnter:c,onMouseLeave:d,onTouchStart:f}=t,h=g.useRef(null);g.useEffect(()=>{if(e==="render"&&i(!0),e==="viewport"){let v=p=>{p.forEach(m=>{i(m.isIntersecting)})},S=new IntersectionObserver(v,{threshold:.5});return h.current&&S.observe(h.current),()=>{S.disconnect()}}},[e]),g.useEffect(()=>{if(r){let v=setTimeout(()=>{i(!0)},100);return()=>{clearTimeout(v)}}},[r]);let _=()=>{o(!0)},w=()=>{o(!1),i(!1)};return n?e!=="intent"?[l,h,{}]:[l,h,{onFocus:hr(a,_),onBlur:hr(u,w),onMouseEnter:hr(c,_),onMouseLeave:hr(d,w),onTouchStart:hr(f,_)}]:[!1,h,{}]}function hr(e,t){return n=>{e&&e(n),n.defaultPrevented||t(n)}}function Og({page:e,...t}){let n=Ky(),{nonce:r}=Bl(),{router:o}=Ma(),l=g.useMemo(()=>Af(o.routes,e,o.basename),[o.routes,e,o.basename]);return l?(t.nonce==null&&r&&(t={...t,nonce:r}),n?g.createElement(Ag,{page:e,matches:l,...t}):g.createElement(Bg,{page:e,matches:l,...t})):null}function zg(e){let{manifest:t,routeModules:n}=Bl(),[r,o]=g.useState([]);return g.useEffect(()=>{let l=!1;return Pg(e,t,n).then(i=>{l||o(i)}),()=>{l=!0}},[e,t,n]),r}function Ag({page:e,matches:t,...n}){let r=kt(),{future:o}=Bl(),{basename:l}=Ma(),i=g.useMemo(()=>{if(e===r.pathname+r.search+r.hash)return[];let a=rp(e,l,o.v8_trailingSlashAwareDataRequests,"rsc"),u=!1,c=[];for(let d of t)typeof d.route.shouldRevalidate=="function"?u=!0:c.push(d.route.id);return u&&c.length>0&&a.searchParams.set("_routes",c.join(",")),[a.pathname+a.search]},[l,o.v8_trailingSlashAwareDataRequests,e,r,t]);return g.createElement(g.Fragment,null,i.map(a=>g.createElement("link",{key:a,rel:"prefetch",as:"fetch",href:a,...n})))}function Bg({page:e,matches:t,...n}){let r=kt(),{future:o,manifest:l,routeModules:i}=Bl(),{basename:a}=Ma(),{loaderData:u,matches:c}=bg(),d=g.useMemo(()=>ac(e,t,c,l,r,"data"),[e,t,c,l,r]),f=g.useMemo(()=>ac(e,t,c,l,r,"assets"),[e,t,c,l,r]),h=g.useMemo(()=>{if(e===r.pathname+r.search+r.hash)return[];let v=new Set,S=!1;if(t.forEach(m=>{var x;let y=l.routes[m.route.id];!y||!y.hasLoader||(!d.some(k=>k.route.id===m.route.id)&&m.route.id in u&&((x=i[m.route.id])!=null&&x.shouldRevalidate)||y.hasClientLoader?S=!0:v.add(m.route.id))}),v.size===0)return[];let p=rp(e,a,o.v8_trailingSlashAwareDataRequests,"data");return S&&v.size>0&&p.searchParams.set("_routes",t.filter(m=>v.has(m.route.id)).map(m=>m.route.id).join(",")),[p.pathname+p.search]},[a,o.v8_trailingSlashAwareDataRequests,u,r,l,d,t,e,i]),_=g.useMemo(()=>Lg(f,l),[f,l]),w=zg(f);return g.createElement(g.Fragment,null,h.map(v=>g.createElement("link",{key:v,rel:"prefetch",as:"fetch",href:v,...n})),_.map(v=>g.createElement("link",{key:v,rel:"modulepreload",href:v,...n})),w.map(({key:v,link:S})=>g.createElement("link",{key:v,nonce:n.nonce,...S,crossOrigin:S.crossOrigin??n.crossOrigin})))}function Fg(...e){return t=>{e.forEach(n=>{typeof n=="function"?n(t):n!=null&&(n.current=t)})}}var Dg=typeof window<"u"&&typeof window.document<"u"&&typeof window.document.createElement<"u";try{Dg&&(window.__reactRouterVersion="7.18.0")}catch{}function Ug({basename:e,children:t,useTransitions:n,window:r}){let o=g.useRef();o.current==null&&(o.current=wy({window:r,v5Compat:!0}));let l=o.current,[i,a]=g.useState({action:l.action,location:l.location}),u=g.useCallback(c=>{n===!1?a(c):g.startTransition(()=>a(c))},[n]);return g.useLayoutEffect(()=>l.listen(u),[l,u]),g.createElement(gg,{basename:e,children:t,location:i.location,navigationType:i.action,navigator:l,useTransitions:n})}var Ve=g.forwardRef(function({onClick:t,discover:n="render",prefetch:r="none",relative:o,reloadDocument:l,replace:i,mask:a,state:u,target:c,to:d,preventScrollReset:f,viewTransition:h,defaultShouldRevalidate:_,...w},v){let{basename:S,navigator:p,useTransitions:m}=g.useContext(et),y=typeof d=="string"&&Pa.test(d),x=Qf(d,S);d=x.to;let k=tg(d,{relative:o}),E=kt(),N=null;if(a){let W=La(a,[],E.mask?E.mask.pathname:"/",!0);S!=="/"&&(W.pathname=W.pathname==="/"?S:dt([S,W.pathname])),N=p.createHref(W)}let[C,z,I]=Mg(r,w),A=Qg(d,{replace:i,mask:a,state:u,target:c,preventScrollReset:f,relative:o,viewTransition:h,defaultShouldRevalidate:_,useTransitions:m});function Z(W){t&&t(W),W.defaultPrevented||A(W)}let ae=!(x.isExternal||l),M=g.createElement("a",{...w,...I,href:(ae?N:void 0)||x.absoluteURL||k,onClick:ae?Z:t,ref:Fg(v,z),target:c,"data-discover":!y&&n==="render"?"true":void 0});return C&&!y?g.createElement(g.Fragment,null,M,g.createElement(Og,{page:k})):M});Ve.displayName="Link";var Hg=g.forwardRef(function({"aria-current":t="page",caseSensitive:n=!1,className:r="",end:o=!1,style:l,to:i,viewTransition:a,children:u,...c},d){let f=io(i,{relative:c.relative}),h=kt(),_=g.useContext(zl),{navigator:w,basename:v}=g.useContext(et),S=_!=null&&Xg(f)&&a===!0,p=w.encodeLocation?w.encodeLocation(f).pathname:f.pathname,m=h.pathname,y=_&&_.navigation&&_.navigation.location?_.navigation.location.pathname:null;n||(m=m.toLowerCase(),y=y?y.toLowerCase():null,p=p.toLowerCase()),y&&v&&(y=Tt(y,v)||y);const x=p!=="/"&&p.endsWith("/")?p.length-1:p.length;let k=m===p||!o&&m.startsWith(p)&&m.charAt(x)==="/",E=y!=null&&(y===p||!o&&y.startsWith(p)&&y.charAt(p.length)==="/"),N={isActive:k,isPending:E,isTransitioning:S},C=k?t:void 0,z;typeof r=="function"?z=r(N):z=[r,k?"active":null,E?"pending":null,S?"transitioning":null].filter(Boolean).join(" ");let I=typeof l=="function"?l(N):l;return g.createElement(Ve,{...c,"aria-current":C,className:z,ref:d,style:I,to:i,viewTransition:a},typeof u=="function"?u(N):u)});Hg.displayName="NavLink";var Vg=g.forwardRef(({discover:e="render",fetcherKey:t,navigate:n,reloadDocument:r,replace:o,state:l,method:i=Do,action:a,onSubmit:u,relative:c,preventScrollReset:d,viewTransition:f,defaultShouldRevalidate:h,..._},w)=>{let{useTransitions:v}=g.useContext(et),S=Gg(),p=Yg(a,{relative:c}),m=i.toLowerCase()==="get"?"get":"post",y=typeof a=="string"&&Pa.test(a),x=k=>{if(u&&u(k),k.defaultPrevented)return;k.preventDefault();let E=k.nativeEvent.submitter,N=(E==null?void 0:E.getAttribute("formmethod"))||i,C=()=>S(E||k.currentTarget,{fetcherKey:t,method:N,navigate:n,replace:o,state:l,relative:c,preventScrollReset:d,viewTransition:f,defaultShouldRevalidate:h});v&&n!==!1?g.startTransition(()=>C()):C()};return g.createElement("form",{ref:w,method:m,action:p,onSubmit:r?u:x,..._,"data-discover":!y&&e==="render"?"true":void 0})});Vg.displayName="Form";function Wg(e){return`${e} must be used within a data router.  See https://reactrouter.com/en/main/routers/picking-a-router.`}function op(e){let t=g.useContext(or);return le(t,Wg(e)),t}function Qg(e,{target:t,replace:n,mask:r,state:o,preventScrollReset:l,relative:i,viewTransition:a,defaultShouldRevalidate:u,useTransitions:c}={}){let d=Zf(),f=kt(),h=io(e,{relative:i});return g.useCallback(_=>{if(kg(_,t)){_.preventDefault();let w=n!==void 0?n:Yr(f)===Yr(h),v=()=>d(e,{replace:w,mask:r,state:o,preventScrollReset:l,relative:i,viewTransition:a,defaultShouldRevalidate:u});c?g.startTransition(()=>v()):v()}},[f,d,h,n,r,o,t,e,l,i,a,u,c])}var qg=0,Kg=()=>`__${String(++qg)}__`;function Gg(){let{router:e}=op("useSubmit"),{basename:t}=g.useContext(et),n=pg(),r=e.fetch,o=e.navigate;return g.useCallback(async(l,i={})=>{let{action:a,method:u,encType:c,formData:d,body:f}=Cg(l,t);if(i.navigate===!1){let h=i.fetcherKey||Kg();await r(h,n,i.action||a,{defaultShouldRevalidate:i.defaultShouldRevalidate,preventScrollReset:i.preventScrollReset,formData:d,body:f,formMethod:i.method||u,formEncType:i.encType||c,flushSync:i.flushSync})}else await o(i.action||a,{defaultShouldRevalidate:i.defaultShouldRevalidate,preventScrollReset:i.preventScrollReset,formData:d,body:f,formMethod:i.method||u,formEncType:i.encType||c,replace:i.replace,state:i.state,fromRouteId:n,flushSync:i.flushSync,viewTransition:i.viewTransition})},[r,o,t,n])}function Yg(e,{relative:t}={}){let{basename:n}=g.useContext(et),r=g.useContext(St);le(r,"useFormAction must be used inside a RouteContext");let[o]=r.matches.slice(-1),l={...io(e||".",{relative:t})},i=kt();if(e==null){l.search=i.search;let a=new URLSearchParams(l.search),u=a.getAll("index");if(u.some(d=>d==="")){a.delete("index"),u.filter(f=>f).forEach(f=>a.append("index",f));let d=a.toString();l.search=d?`?${d}`:""}}return(!e||e===".")&&o.route.index&&(l.search=l.search?l.search.replace(/^\?/,"?index&"):"?index"),n!=="/"&&(l.pathname=l.pathname==="/"?n:dt([n,l.pathname])),Yr(l)}function Xg(e,{relative:t}={}){let n=g.useContext(Gf);le(n!=null,"`useViewTransitionState` must be used within `react-router-dom`'s `RouterProvider`.  Did you accidentally import `RouterProvider` from `react-router`?");let{basename:r}=op("useViewTransitionState"),o=io(e,{relative:t});if(!n.isTransitioning)return!1;let l=Tt(n.currentLocation.pathname,r)||n.currentLocation.pathname,i=Tt(n.nextLocation.pathname,r)||n.nextLocation.pathname;return pl(o.pathname,i)!=null||pl(o.pathname,l)!=null}var lp={exports:{}},ip={};/**
 * @license React
 * use-sync-external-store-shim.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Zn=g;function Jg(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var Zg=typeof Object.is=="function"?Object.is:Jg,ev=Zn.useState,tv=Zn.useEffect,nv=Zn.useLayoutEffect,rv=Zn.useDebugValue;function ov(e,t){var n=t(),r=ev({inst:{value:n,getSnapshot:t}}),o=r[0].inst,l=r[1];return nv(function(){o.value=n,o.getSnapshot=t,Oi(o)&&l({inst:o})},[e,n,t]),tv(function(){return Oi(o)&&l({inst:o}),e(function(){Oi(o)&&l({inst:o})})},[e]),rv(n),n}function Oi(e){var t=e.getSnapshot;e=e.value;try{var n=t();return!Zg(e,n)}catch{return!0}}function lv(e,t){return t()}var iv=typeof window>"u"||typeof window.document>"u"||typeof window.document.createElement>"u"?lv:ov;ip.useSyncExternalStore=Zn.useSyncExternalStore!==void 0?Zn.useSyncExternalStore:iv;lp.exports=ip;var sv=lp.exports,sp={exports:{}},ap={};/**
 * @license React
 * use-sync-external-store-shim/with-selector.production.js
 *
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Fl=g,av=sv;function uv(e,t){return e===t&&(e!==0||1/e===1/t)||e!==e&&t!==t}var cv=typeof Object.is=="function"?Object.is:uv,dv=av.useSyncExternalStore,fv=Fl.useRef,pv=Fl.useEffect,mv=Fl.useMemo,hv=Fl.useDebugValue;ap.useSyncExternalStoreWithSelector=function(e,t,n,r,o){var l=fv(null);if(l.current===null){var i={hasValue:!1,value:null};l.current=i}else i=l.current;l=mv(function(){function u(_){if(!c){if(c=!0,d=_,_=r(_),o!==void 0&&i.hasValue){var w=i.value;if(o(w,_))return f=w}return f=_}if(w=f,cv(d,_))return w;var v=r(_);return o!==void 0&&o(w,v)?(d=_,w):(d=_,f=v)}var c=!1,d,f,h=n===void 0?null:n;return[function(){return u(t())},h===null?void 0:function(){return u(h())}]},[t,n,r,o]);var a=dv(e,l[0],l[1]);return pv(function(){i.hasValue=!0,i.value=a},[a]),hv(a),a};sp.exports=ap;var yv=sp.exports;function gv(e){e()}let up=gv;const vv=e=>up=e,_v=()=>up,uc=Symbol.for("react-redux-context"),cc=typeof globalThis<"u"?globalThis:{};function wv(){var e;if(!g.createContext)return{};const t=(e=cc[uc])!=null?e:cc[uc]=new Map;let n=t.get(g.createContext);return n||(n=g.createContext(null),t.set(g.createContext,n)),n}const Jt=wv();function za(e=Jt){return function(){return g.useContext(e)}}const cp=za(),xv=()=>{throw new Error("uSES not initialized!")};let dp=xv;const Sv=e=>{dp=e},kv=(e,t)=>e===t;function Ev(e=Jt){const t=e===Jt?cp:za(e);return function(r,o={}){const{equalityFn:l=kv,stabilityCheck:i=void 0,noopCheck:a=void 0}=typeof o=="function"?{equalityFn:o}:o,{store:u,subscription:c,getServerState:d,stabilityCheck:f,noopCheck:h}=t();g.useRef(!0);const _=g.useCallback({[r.name](v){return r(v)}}[r.name],[r,f,i]),w=dp(c.addNestedSub,u.getState,d||u.getState,_,l);return g.useDebugValue(w),w}}const fe=Ev();var fp={exports:{}},G={};/** @license React v16.13.1
 * react-is.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var ge=typeof Symbol=="function"&&Symbol.for,Aa=ge?Symbol.for("react.element"):60103,Ba=ge?Symbol.for("react.portal"):60106,Dl=ge?Symbol.for("react.fragment"):60107,Ul=ge?Symbol.for("react.strict_mode"):60108,Hl=ge?Symbol.for("react.profiler"):60114,Vl=ge?Symbol.for("react.provider"):60109,Wl=ge?Symbol.for("react.context"):60110,Fa=ge?Symbol.for("react.async_mode"):60111,Ql=ge?Symbol.for("react.concurrent_mode"):60111,ql=ge?Symbol.for("react.forward_ref"):60112,Kl=ge?Symbol.for("react.suspense"):60113,jv=ge?Symbol.for("react.suspense_list"):60120,Gl=ge?Symbol.for("react.memo"):60115,Yl=ge?Symbol.for("react.lazy"):60116,Cv=ge?Symbol.for("react.block"):60121,Nv=ge?Symbol.for("react.fundamental"):60117,Rv=ge?Symbol.for("react.responder"):60118,Pv=ge?Symbol.for("react.scope"):60119;function qe(e){if(typeof e=="object"&&e!==null){var t=e.$$typeof;switch(t){case Aa:switch(e=e.type,e){case Fa:case Ql:case Dl:case Hl:case Ul:case Kl:return e;default:switch(e=e&&e.$$typeof,e){case Wl:case ql:case Yl:case Gl:case Vl:return e;default:return t}}case Ba:return t}}}function pp(e){return qe(e)===Ql}G.AsyncMode=Fa;G.ConcurrentMode=Ql;G.ContextConsumer=Wl;G.ContextProvider=Vl;G.Element=Aa;G.ForwardRef=ql;G.Fragment=Dl;G.Lazy=Yl;G.Memo=Gl;G.Portal=Ba;G.Profiler=Hl;G.StrictMode=Ul;G.Suspense=Kl;G.isAsyncMode=function(e){return pp(e)||qe(e)===Fa};G.isConcurrentMode=pp;G.isContextConsumer=function(e){return qe(e)===Wl};G.isContextProvider=function(e){return qe(e)===Vl};G.isElement=function(e){return typeof e=="object"&&e!==null&&e.$$typeof===Aa};G.isForwardRef=function(e){return qe(e)===ql};G.isFragment=function(e){return qe(e)===Dl};G.isLazy=function(e){return qe(e)===Yl};G.isMemo=function(e){return qe(e)===Gl};G.isPortal=function(e){return qe(e)===Ba};G.isProfiler=function(e){return qe(e)===Hl};G.isStrictMode=function(e){return qe(e)===Ul};G.isSuspense=function(e){return qe(e)===Kl};G.isValidElementType=function(e){return typeof e=="string"||typeof e=="function"||e===Dl||e===Ql||e===Hl||e===Ul||e===Kl||e===jv||typeof e=="object"&&e!==null&&(e.$$typeof===Yl||e.$$typeof===Gl||e.$$typeof===Vl||e.$$typeof===Wl||e.$$typeof===ql||e.$$typeof===Nv||e.$$typeof===Rv||e.$$typeof===Pv||e.$$typeof===Cv)};G.typeOf=qe;fp.exports=G;var Lv=fp.exports,mp=Lv,Iv={$$typeof:!0,render:!0,defaultProps:!0,displayName:!0,propTypes:!0},$v={$$typeof:!0,compare:!0,defaultProps:!0,displayName:!0,propTypes:!0,type:!0},hp={};hp[mp.ForwardRef]=Iv;hp[mp.Memo]=$v;var Y={};/**
 * @license React
 * react-is.production.min.js
 *
 * Copyright (c) Facebook, Inc. and its affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */var Da=Symbol.for("react.element"),Ua=Symbol.for("react.portal"),Xl=Symbol.for("react.fragment"),Jl=Symbol.for("react.strict_mode"),Zl=Symbol.for("react.profiler"),ei=Symbol.for("react.provider"),ti=Symbol.for("react.context"),Tv=Symbol.for("react.server_context"),ni=Symbol.for("react.forward_ref"),ri=Symbol.for("react.suspense"),oi=Symbol.for("react.suspense_list"),li=Symbol.for("react.memo"),ii=Symbol.for("react.lazy"),bv=Symbol.for("react.offscreen"),yp;yp=Symbol.for("react.module.reference");function tt(e){if(typeof e=="object"&&e!==null){var t=e.$$typeof;switch(t){case Da:switch(e=e.type,e){case Xl:case Zl:case Jl:case ri:case oi:return e;default:switch(e=e&&e.$$typeof,e){case Tv:case ti:case ni:case ii:case li:case ei:return e;default:return t}}case Ua:return t}}}Y.ContextConsumer=ti;Y.ContextProvider=ei;Y.Element=Da;Y.ForwardRef=ni;Y.Fragment=Xl;Y.Lazy=ii;Y.Memo=li;Y.Portal=Ua;Y.Profiler=Zl;Y.StrictMode=Jl;Y.Suspense=ri;Y.SuspenseList=oi;Y.isAsyncMode=function(){return!1};Y.isConcurrentMode=function(){return!1};Y.isContextConsumer=function(e){return tt(e)===ti};Y.isContextProvider=function(e){return tt(e)===ei};Y.isElement=function(e){return typeof e=="object"&&e!==null&&e.$$typeof===Da};Y.isForwardRef=function(e){return tt(e)===ni};Y.isFragment=function(e){return tt(e)===Xl};Y.isLazy=function(e){return tt(e)===ii};Y.isMemo=function(e){return tt(e)===li};Y.isPortal=function(e){return tt(e)===Ua};Y.isProfiler=function(e){return tt(e)===Zl};Y.isStrictMode=function(e){return tt(e)===Jl};Y.isSuspense=function(e){return tt(e)===ri};Y.isSuspenseList=function(e){return tt(e)===oi};Y.isValidElementType=function(e){return typeof e=="string"||typeof e=="function"||e===Xl||e===Zl||e===Jl||e===ri||e===oi||e===bv||typeof e=="object"&&e!==null&&(e.$$typeof===ii||e.$$typeof===li||e.$$typeof===ei||e.$$typeof===ti||e.$$typeof===ni||e.$$typeof===yp||e.getModuleId!==void 0)};Y.typeOf=tt;function Mv(){const e=_v();let t=null,n=null;return{clear(){t=null,n=null},notify(){e(()=>{let r=t;for(;r;)r.callback(),r=r.next})},get(){let r=[],o=t;for(;o;)r.push(o),o=o.next;return r},subscribe(r){let o=!0,l=n={callback:r,next:null,prev:n};return l.prev?l.prev.next=l:t=l,function(){!o||t===null||(o=!1,l.next?l.next.prev=l.prev:n=l.prev,l.prev?l.prev.next=l.next:t=l.next)}}}}const dc={notify(){},get:()=>[]};function Ov(e,t){let n,r=dc,o=0,l=!1;function i(v){d();const S=r.subscribe(v);let p=!1;return()=>{p||(p=!0,S(),f())}}function a(){r.notify()}function u(){w.onStateChange&&w.onStateChange()}function c(){return l}function d(){o++,n||(n=e.subscribe(u),r=Mv())}function f(){o--,n&&o===0&&(n(),n=void 0,r.clear(),r=dc)}function h(){l||(l=!0,d())}function _(){l&&(l=!1,f())}const w={addNestedSub:i,notifyNestedSubs:a,handleChangeWrapper:u,isSubscribed:c,trySubscribe:h,tryUnsubscribe:_,getListeners:()=>r};return w}const zv=typeof window<"u"&&typeof window.document<"u"&&typeof window.document.createElement<"u",Av=zv?g.useLayoutEffect:g.useEffect;function Bv({store:e,context:t,children:n,serverState:r,stabilityCheck:o="once",noopCheck:l="once"}){const i=g.useMemo(()=>{const c=Ov(e);return{store:e,subscription:c,getServerState:r?()=>r:void 0,stabilityCheck:o,noopCheck:l}},[e,r,o,l]),a=g.useMemo(()=>e.getState(),[e]);Av(()=>{const{subscription:c}=i;return c.onStateChange=c.notifyNestedSubs,c.trySubscribe(),a!==e.getState()&&c.notifyNestedSubs(),()=>{c.tryUnsubscribe(),c.onStateChange=void 0}},[i,a]);const u=t||Jt;return g.createElement(u.Provider,{value:i},n)}function gp(e=Jt){const t=e===Jt?cp:za(e);return function(){const{store:r}=t();return r}}const Fv=gp();function Dv(e=Jt){const t=e===Jt?Fv:gp(e);return function(){return t().dispatch}}const so=Dv();Sv(yv.useSyncExternalStoreWithSelector);vv(Of.unstable_batchedUpdates);function Ha({title:e,description:t}){return g.useEffect(()=>{document.title=e;let n=document.querySelector('meta[name="description"]');n||(n=document.createElement("meta"),n.name="description",document.head.appendChild(n)),n.content=t},[e,t]),null}const Uv="_wrapper_1kvma_1",Hv="_icon_1kvma_20",Vv="_input_1kvma_26",Wv="_clear_1kvma_42",No={wrapper:Uv,icon:Hv,input:Vv,clear:Wv};function hl({value:e,onChange:t,onSubmit:n}){return s.jsxs("div",{className:No.wrapper,children:[s.jsxs("svg",{className:No.icon,width:"18",height:"18",viewBox:"0 0 24 24",fill:"none","aria-hidden":"true",children:[s.jsx("circle",{cx:"11",cy:"11",r:"7",stroke:"currentColor",strokeWidth:"2"}),s.jsx("line",{x1:"16.5",y1:"16.5",x2:"21",y2:"21",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"})]}),s.jsx("input",{className:No.input,type:"text",placeholder:"Поиск инструкций...",value:e,onChange:r=>t(r.target.value),onKeyDown:r=>{r.key==="Enter"&&typeof n=="function"&&(r.preventDefault(),n(e))},"aria-label":"Поиск инструкций по охране труда"}),e&&s.jsx("button",{type:"button",className:No.clear,onClick:()=>t(""),"aria-label":"Очистить поиск",children:"×"})]})}const Qv="_button_w8p0n_1",qv="_badge_w8p0n_23",Kv="_text_w8p0n_31",Gv="_title_w8p0n_37",Yv="_subtitle_w8p0n_44",yr={button:Qv,badge:qv,text:Kv,title:Gv,subtitle:Yv},Xv="https://boykovgroup.ru";function yl(){return s.jsxs("a",{className:yr.button,href:Xv,target:"_blank",rel:"noopener noreferrer","aria-label":"Перейти на сайт boykovgroup.ru",children:[s.jsx("img",{className:yr.badge,src:"/brand/logo-icon.png",alt:"",width:46,height:46}),s.jsxs("span",{className:yr.text,children:[s.jsx("span",{className:yr.title,children:"БОЙКОВГРУПП"}),s.jsx("span",{className:yr.subtitle,children:"ООО «Спецконс»"})]})]})}const Jv="_navigation_hh29i_1",Zv="_link_hh29i_13",fc={navigation:Jv,link:Zv},e1=["Охрана труда","Пожарная безопасность","Роспотребнадзор","ГО и ЧС","Антитеррористическая безопасность","Иные услуги"];function Xr(){return s.jsx("nav",{className:fc.navigation,children:e1.map(e=>s.jsx("a",{href:"#",className:fc.link,children:e},e))})}const t1="_wrap_qd7mm_1",n1="_photoCircle_qd7mm_23",r1="_photo_qd7mm_23",o1="_info_qd7mm_50",l1="_name_qd7mm_65",i1="_role_qd7mm_96",s1="_compact_qd7mm_121",nn={wrap:t1,photoCircle:n1,photo:r1,info:o1,name:l1,role:i1,compact:s1};function gl({compact:e=!1}){return s.jsxs("figure",{className:[nn.wrap,e?nn.compact:""].filter(Boolean).join(" "),children:[s.jsx("div",{className:nn.photoCircle,children:s.jsxs("picture",{children:[s.jsx("source",{srcSet:"/team/nikolay-boykov.webp",type:"image/webp"}),s.jsx("img",{className:nn.photo,src:"/team/nikolay-boykov.png",alt:"Николай Бойков — генеральный директор ООО «Спецконс»",width:370,height:368})]})}),s.jsxs("figcaption",{className:nn.info,children:[s.jsx("span",{className:nn.name,children:"Николай Бойков"}),s.jsxs("span",{className:nn.role,children:["Генеральный директор",s.jsx("br",{}),"ООО «Спецконс»"]})]})]})}const a1="_header_1rs1k_1",u1="_inner_1rs1k_23",c1="_controls_1rs1k_44",d1="_search_1rs1k_74",f1="_logo_1rs1k_104",p1="_navigation_1rs1k_158",m1="_profileRow_1rs1k_202",h1="_title_1rs1k_233",y1="_profile_1rs1k_202",g1="_titleLink_1rs1k_336",v1="_profileLink_1rs1k_357",ot={header:a1,inner:u1,controls:c1,search:d1,logo:f1,navigation:p1,profileRow:m1,title:h1,profile:y1,titleLink:g1,profileLink:v1};function _1(){const[e,t]=g.useState("");function n(r){const o=String(r??"").trim(),l=o?`/?q=${encodeURIComponent(o)}`:"/";window.location.assign(l)}return s.jsx("header",{className:ot.header,children:s.jsxs("div",{className:ot.inner,children:[s.jsxs("div",{className:ot.controls,children:[s.jsx("div",{className:ot.search,children:s.jsx(hl,{value:e,onChange:t,onSubmit:n})}),s.jsx("div",{className:ot.logo,children:s.jsx(yl,{})})]}),s.jsx("div",{className:ot.navigation,children:s.jsx(Xr,{})}),s.jsxs("div",{className:ot.profileRow,children:[s.jsx(Ve,{to:"/",className:ot.titleLink,"aria-label":"На главную страницу",children:s.jsx("div",{className:ot.title,children:"Инструкции по охране труда"})}),s.jsx(Ve,{to:"/",className:ot.profileLink,"aria-label":"На главную страницу",children:s.jsx("div",{className:ot.profile,children:s.jsx(gl,{compact:!0})})})]})]})})}function w1({instruction:e}){const t={"@context":"https://schema.org","@type":"Article",headline:e.title,description:`Инструкция по охране труда для ${e.profession}`,author:{"@type":"Organization",name:"БОЙКОВГРУПП"}};return s.jsx("script",{type:"application/ld+json",dangerouslySetInnerHTML:{__html:JSON.stringify(t)}})}const x1="_breadcrumbs_sjww8_1",S1={breadcrumbs:x1};function k1({instruction:e}){return s.jsxs("nav",{className:S1.breadcrumbs,"aria-label":"Хлебные крошки",children:[s.jsx(Ve,{to:"/",children:"Главная"}),s.jsx("span",{children:"→"}),s.jsx(Ve,{to:"/instrukcii-po-ohrane-truda",children:"Инструкции по охране труда"}),s.jsx("span",{children:"→"}),s.jsx("span",{children:e.profession})]})}function E1({title:e,description:t,image:n="/brand/logo-icon.png"}){return g.useEffect(()=>{document.title=e;const r=(o,l)=>{let i=document.querySelector(`meta[property="${o}"]`);i||(i=document.createElement("meta"),i.setAttribute("property",o),document.head.appendChild(i)),i.setAttribute("content",l)};r("og:title",e),r("og:description",t),r("og:image",`https://boykovgroup.ru${n}`),r("og:type","article")},[e,t,n]),null}const j1="_block_3lwxb_1",C1={block:j1};function N1({instruction:e}){const t=e.profession;return s.jsxs("section",{className:C1.block,children:[s.jsx("h2",{children:e.title}),s.jsx("p",{children:e.intro}),s.jsx("h3",{children:"Кому необходима инструкция"}),s.jsxs("p",{children:['Документ применяется для работников, выполняющих обязанности по профессии "',t,'". Инструкция используется при проведении инструктажей по охране труда и организации безопасного выполнения работ.']}),s.jsx("h3",{children:"Что содержит инструкция"}),s.jsxs("ul",{children:[s.jsx("li",{children:"требования безопасности перед началом работы;"}),s.jsx("li",{children:"правила безопасного выполнения работ;"}),s.jsx("li",{children:"требования при возникновении аварийных ситуаций;"}),s.jsx("li",{children:"порядок действий после окончания работы."})]}),s.jsx("h3",{children:"Нормативная база"}),s.jsx("p",{children:"Инструкция разрабатывается с учетом требований законодательства Российской Федерации в области охраны труда и действующих нормативных документов."}),s.jsx("h3",{children:"Часто задаваемые вопросы"}),s.jsx("p",{children:s.jsx("strong",{children:"Нужно ли утверждать инструкцию по охране труда?"})}),s.jsx("p",{children:"Да, инструкция должна быть утверждена работодателем и применяться в организации в установленном порядке."})]})}const R1="_block_1lm9i_1",P1="_grid_1lm9i_20",L1="_card_1lm9i_33",zi={block:R1,grid:P1,card:L1};function I1({currentId:e,instructions:t}){const n=t.filter(r=>r.id!==e).slice(0,4);return n.length?s.jsxs("section",{className:zi.block,children:[s.jsx("h2",{children:"Похожие инструкции по охране труда"}),s.jsx("div",{className:zi.grid,children:n.map(r=>s.jsx(Ve,{to:`/instrukciya-po-ohrane-truda/${r.id}`,className:zi.card,children:r.title},r.id))})]}):null}const $1="_overlay_s7d35_1",T1="_modal_s7d35_12",b1="_close_s7d35_30",M1="_section_s7d35_98",O1="_save_s7d35_118",gr={overlay:$1,modal:T1,close:b1,section:M1,save:O1};function vp({instruction:e,onClose:t,onSave:n}){

const[r,o]=g.useState({

...e,

sections:
(e.sections||[])
.map(
(u,c)=>{

const d=
Array.isArray(u.paragraphs)
?u.paragraphs
:[];

return{

...u,

number:
u.number??c+1,

heading:
u.heading??"",

paragraphs:
[...d],

__editorText:
d
.map(
f=>
typeof f==="string"
?f
:String(
f?.text??
f?.content??
f??""
)
)
.join("\n\n")

};

}
)

});


const[l,a]=g.useState(!1);


/* Общее поле инструкции */
function i(u,c){

o(d=>({
...d,
[u]:c
}));

}


/* Заголовок раздела */
function h(u,c){

o(d=>({

...d,

sections:
(d.sections||[])
.map(
(f,p)=>
p===u
?{
...f,
heading:c
}
:f
)

}));

}


/* Единый текст раздела */
function m(u,c){

o(d=>({

...d,

sections:
(d.sections||[])
.map(
(f,p)=>
p===u
?{
...f,
__editorText:c
}
:f
)

}));

}


/* Удалить раздел */
function x(u){

o(c=>({

...c,

sections:
(c.sections||[])
.filter(
(d,f)=>
f!==u
)
.map(
(d,f)=>({
...d,
number:f+1
})
)

}));

}


/* Добавить раздел */
function w(){

o(u=>{

const c=
Array.isArray(u.sections)
?u.sections
:[];

return{

...u,

sections:[
...c,

{
number:c.length+1,
heading:"",
paragraphs:[],
__editorText:""
}

]

};

});

}


/* Сохранение */
async function j(){

if(l){
return;
}

a(!0);

try{

const u={

...r,

sections:
(r.sections||[])
.map(
({
__editorText:c,
...d
})=>({

...d,

paragraphs:
String(c??"")
.replace(/\r\n?/g,"\n")
.split(/\n\s*\n/u)
.map(
f=>f.trim()
)
.filter(Boolean)

})
)

};

await n(u);

}

finally{

a(!1);

}

}


return s.jsx(
"div",
{

className:
gr.overlay,

children:s.jsxs(
"div",
{

className:
`${gr.modal} editorFullModal`,

children:[


s.jsx(
"button",
{
type:"button",
className:gr.close,
onClick:t,
children:"×"
}
),


s.jsx(
"h2",
{
children:
"Редактирование инструкции"
}
),


s.jsxs(
"label",
{

className:
"editorField",

children:[

"Название",

s.jsx(
"input",
{
value:r.title??"",
onChange:u=>
i(
"title",
u.target.value
)
}
)

]

}
),


s.jsxs(
"label",
{

className:
"editorField",

children:[

"Вводный текст",

s.jsx(
"textarea",
{
value:r.intro??"",
onChange:u=>
i(
"intro",
u.target.value
)
}
)

]

}
),


(r.sections||[])
.map(
(u,c)=>
s.jsxs(
"div",
{

className:
"editorSection editorUnifiedSection",

children:[


s.jsxs(
"div",
{

className:
"editorSectionHeader",

children:[

s.jsx(
"h3",
{
children:
`Раздел ${u.number}`
}
),


s.jsx(
"button",
{

type:"button",

className:
"editorDangerButton",

onClick:()=>{

if(
!String(
u.__editorText??""
).trim()
||
window.confirm(
`Удалить раздел ${u.number}?`
)
){

x(c);

}

},

children:
"Удалить раздел"

}
)

]

}
),


s.jsxs(
"label",
{

className:
"editorField",

children:[

"Заголовок раздела",

s.jsx(
"input",
{

value:
u.heading??"",

onChange:d=>
h(
c,
d.target.value
),

placeholder:
`Название раздела ${u.number}`

}
)

]

}
),


s.jsxs(
"label",
{

className:
"editorUnifiedSectionField",

children:[


s.jsx(
"span",
{

className:
"editorUnifiedSectionLabel",

children:
"Содержание раздела"

}
),


s.jsx(
"textarea",
{

className:
"editorUnifiedSectionTextarea",

value:
u.__editorText??"",

onChange:d=>
m(
c,
d.target.value
),

placeholder:
"Введите содержание всего раздела"

}
),


s.jsx(
"span",
{

className:
"editorUnifiedSectionHint",

children:
"Весь раздел редактируется здесь целиком. Новый абзац отделяйте пустой строкой."

}
)

]

}
)


]

},

`${u.number}-${c}`
)
),


s.jsx(
"button",
{

type:"button",

className:
"editorAddSectionButton",

onClick:w,

children:
"+ Добавить раздел"

}
),


s.jsx(
"button",
{

type:"button",

className:
gr.save,

onClick:j,

disabled:l,

children:
l
?"Сохранение..."
:"Сохранить изменения"

}
)

]

}
)

}
)
}
const z1="";async function Va(e,t={}){const{headers:n,...r}=t,o=await fetch(`${z1}${e}`,{headers:{"Content-Type":"application/json",...n},...r});if(!o.ok){let l=`Ошибка запроса (${o.status})`;try{const i=await o.json();i!=null&&i.error&&(l=i.error)}catch{}throw new Error(l)}return o.status===204?null:o.json()}function A1(e,t){return Va("/api/auth/login",{method:"POST",body:JSON.stringify({login:e,password:t})})}function B1(e,t){return Va("/api/auth/register",{method:"POST",body:JSON.stringify({email:e,password:t})})}function F1(e){return Va("/api/auth/me",{headers:{Authorization:`Bearer ${e}`}})}const vl="boykovgroup_admin_token",_p="auth/start",wp="auth/success",xp="auth/fail",_l="auth/logout",Sp="auth/clearError",D1={token:null,user:null,isRestoring:!0,isAuthenticating:!1,error:null};function U1(e=D1,t){switch(t.type){case _p:return{...e,isAuthenticating:!0,error:null};case wp:return{...e,isAuthenticating:!1,isRestoring:!1,token:t.payload.token,user:t.payload.user,error:null};case xp:return{...e,isAuthenticating:!1,isRestoring:!1,token:null,user:null,error:t.payload};case _l:return{...e,token:null,user:null,isRestoring:!1,isAuthenticating:!1,error:null};case Sp:return{...e,error:null};default:return e}}const kp=()=>({type:_p}),Ep=(e,t)=>({type:wp,payload:{token:e,user:t}}),jp=e=>({type:xp,payload:e});function Cp(e,t){const n=e.user&&e.user.role==="admin"?"admin":"user",r=n==="admin"?vl:"boykovgroup_auth_token";localStorage.setItem(r,e.token),sessionStorage.setItem("boykovgroup_active_auth_role",n),t(Ep(e.token,e.user))}function H1(e,t){return async n=>{n(kp());try{const r=await A1(e,t);return Cp(r,n),!0}catch(r){return n(jp(r.message)),!1}}}function V1(e,t){return async n=>{n(kp());try{const r=await B1(e,t);return Cp(r,n),!0}catch(r){return n(jp(r.message)),!1}}}function pc(){return{type:Sp}}function W1(){return e=>{const t=sessionStorage.getItem("boykovgroup_active_auth_role");t==="user"?localStorage.removeItem("boykovgroup_auth_token"):localStorage.removeItem(vl),sessionStorage.removeItem("boykovgroup_active_auth_role"),e({type:_l})}}function Q1(){return async e=>{const t=sessionStorage.getItem("boykovgroup_active_auth_role"),n=t==="user"?localStorage.getItem("boykovgroup_auth_token"):t==="admin"?localStorage.getItem(vl):localStorage.getItem(vl)||localStorage.getItem("boykovgroup_auth_token");if(!n){e({type:_l});return}try{const t=await F1(n);sessionStorage.setItem("boykovgroup_active_auth_role",t.user&&t.user.role==="admin"?"admin":"user"),e(Ep(n,t.user))}catch{localStorage.getItem(vl)===n&&localStorage.removeItem(vl),localStorage.getItem("boykovgroup_auth_token")===n&&localStorage.removeItem("boykovgroup_auth_token"),sessionStorage.removeItem("boykovgroup_active_auth_role"),e({type:_l})}}}const lr=e=>e.auth.token,q1=e=>e.auth.user,Sn=e=>{var t;return((t=e.auth.user)==null?void 0:t.role)==="admin"},K1=e=>e.auth.isAuthenticating,G1=e=>e.auth.isRestoring,Y1=e=>e.auth.error,X1="_page_ewcuw_1",J1="_content_ewcuw_11",Z1="_back_ewcuw_19",e_="_title_ewcuw_34",t_="_intro_ewcuw_47",n_="_toc_ewcuw_58",r_="_sections_ewcuw_92",o_="_section_ewcuw_92",l_="_editButton_ewcuw_144",i_="_articleMeta_ewcuw_172",s_="_versionInfo_ewcuw_191",a_="_paragraphWithList_ewcuw_230",u_="_paragraphLead_ewcuw_234",c_="_inlineList_ewcuw_238",ke={page:X1,content:J1,back:Z1,title:e_,intro:t_,toc:n_,sections:r_,section:o_,editButton:l_,articleMeta:i_,versionInfo:s_,paragraphWithList:a_,paragraphLead:u_,inlineList:c_};function d_(e,t){var i;const n=String(e??"").trim();if(!/:\\s*-\\s+/.test(n))return s.jsx("p",{children:n},t);const r=n.split(/\\s+-\\s+/),o=(i=r.shift())==null?void 0:i.trim(),l=r.map(a=>a.trim().replace(/;\\s*$/,"")).filter(Boolean);return!o||l.length<2?s.jsx("p",{children:n},t):s.jsxs("div",{className:ke.paragraphWithList,children:[s.jsx("p",{className:ke.paragraphLead,children:o}),s.jsx("ul",{className:ke.inlineList,children:l.map((a,u)=>s.jsx("li",{children:a},u))})]},t)}function f_(){const{id:e}=rg(),t=fe(Sn),[n,r]=g.useState(null),[o,l]=g.useState([]),[i,a]=g.useState(!0),[u,c]=g.useState(""),[d,f]=g.useState(!1);async function h(){try{a(!0);const v=await fetch(`/api/instructions/${e}`);if(!v.ok)throw new Error("Инструкция не найдена");const S=await v.json();r(S);const m=await(await fetch("/api/instructions?page=1&pageSize=200")).json();l(m.items||[]),document.title=`${S.title} | БОЙКОВГРУПП`}catch(v){c(v.message)}finally{a(!1)}}g.useEffect(()=>{h()},[e]);async function _(v){const S=await fetch(`/api/instructions/${n.id}`,{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(v)});if(S.ok){const p=await S.json();r(p),f(!1)}}if(i)return s.jsx("div",{className:ke.page,children:"Загрузка инструкции..."});if(u||!n)return s.jsxs("div",{className:ke.page,children:[s.jsx("h1",{children:"Инструкция не найдена"}),s.jsx(Ve,{to:"/",children:"Вернуться на главную"})]});const w={"@context":"https://schema.org","@type":"BreadcrumbList",itemListElement:[{"@type":"ListItem",position:1,name:"Главная",item:"https://boykovdocs.ru/"},{"@type":"ListItem",position:2,name:"Инструкции по охране труда",item:"https://boykovdocs.ru/instrukcii-po-ohrane-truda"},{"@type":"ListItem",position:3,name:n.title,item:`https://boykovdocs.ru/instrukciya-po-ohrane-truda/${n.id}`}]};return s.jsxs("div",{className:ke.page,children:[s.jsx("script",{type:"application/ld+json",dangerouslySetInnerHTML:{__html:JSON.stringify(w)}}),s.jsx(_1,{}),s.jsxs("main",{className:ke.content,children:[s.jsx(Ha,{title:`${n.title} | БОЙКОВГРУПП`,description:n.intro||n.title}),s.jsx(w1,{instruction:n}),s.jsx(E1,{title:`${n.title} | БОЙКОВГРУПП`,description:n.intro||n.title}),s.jsx(Ve,{to:"/",className:ke.back,children:"← Все инструкции"}),s.jsxs("article",{className:"copyProtectedInstruction",children:[s.jsx(k1,{instruction:n}),s.jsx("h1",{className:ke.title,children:n.title}),s.jsxs("div",{className:ke.articleMeta,children:[s.jsxs("div",{className:ke.versionInfo,children:[s.jsxs("span",{children:["Версия документа: ",n.version||"1.0"]}),s.jsxs("span",{children:["Обновлено:"," ",n.updatedAt?new Date(n.updatedAt).toLocaleDateString("ru-RU"):new Date(n.createdAt).toLocaleDateString("ru-RU")]})]}),t&&s.jsx("button",{className:ke.editButton,onClick:()=>f(!0),children:"Редактировать статью"})]}),s.jsx(N1,{instruction:n}),s.jsxs("div",{className:ke.toc,children:[s.jsx("h2",{children:"Содержание"}),n.sections.map(v=>s.jsxs("a",{href:`#section-${v.number}`,children:["Раздел ",v.number,". ",v.heading]},v.number))]}),s.jsx("div",{className:ke.sections,children:n.sections.map(v=>s.jsxs("section",{id:`section-${v.number}`,className:ke.section,children:[s.jsx("h2",{children:v.heading}),v.paragraphs.map((S,p)=>d_(S,p))]},v.number))}),s.jsx(I1,{currentId:n.id,instructions:o})]})]}),d&&s.jsx(vp,{instruction:n,onClose:()=>f(!1),onSave:_})]})}const p_="_instruction_1vj95_1",m_="_header_1vj95_6",h_="_title_1vj95_11",y_="_intro_1vj95_21",g_="_sections_1vj95_29",v_="_section_1vj95_29",__="_sectionTitle_1vj95_39",w_="_paragraph_1vj95_48",x_="_compact_1vj95_60",yt={instruction:p_,header:m_,title:h_,intro:y_,sections:g_,section:v_,sectionTitle:__,paragraph:w_,compact:x_};function S_(e){const t=(e==null?void 0:e.paragraphs)??(e==null?void 0:e.content)??(e==null?void 0:e.items)??(e==null?void 0:e.text)??[];return Array.isArray(t)?t.flatMap(n=>{if(typeof n=="string")return[n];if(n&&typeof n=="object"){const r=n.text??n.content??n.title??"";return[String(r)]}return[String(n??"")]}).map(n=>n.trim()).filter(Boolean):String(t??"").split(/\n+/u).map(n=>n.trim()).filter(Boolean)}function Np({instruction:e,compact:t=!1}){if(!e)return null;const n=Array.isArray(e.sections)?e.sections:[];return s.jsxs("article",{className:t?`${yt.instruction} ${yt.compact}`:yt.instruction,children:[s.jsxs("header",{className:yt.header,children:[s.jsx("h2",{className:yt.title,children:e.title||`Инструкция по охране труда: ${e.profession||""}`}),e.intro&&s.jsx("p",{className:yt.intro,children:e.intro})]}),s.jsx("div",{className:yt.sections,children:n.map((r,o)=>{const l=S_(r);return s.jsxs("section",{className:yt.section,children:[r.title&&s.jsx("h3",{className:yt.sectionTitle,children:r.title}),l.map((i,a)=>s.jsx("p",{className:yt.paragraph,children:i},a))]},r.id??r.number??o)})})]})}const k_="_overlay_1luot_1",E_="_modal_1luot_13",j_="_close_1luot_36",C_="_eyebrow_1luot_60",N_="_title_1luot_69",R_="_form_1luot_77",P_="_field_1luot_83",L_="_label_1luot_89",I_="_input_1luot_98",$_="_submit_1luot_116",T_="_error_1luot_142",b_="_tabs_1luot_153",M_="_tab_1luot_153",O_="_tabActive_1luot_180",z_="_hint_1luot_185",A_="_adminHint_1luot_192",X={overlay:k_,modal:E_,close:j_,eyebrow:C_,title:N_,form:R_,field:P_,label:L_,input:I_,submit:$_,error:T_,tabs:b_,tab:M_,tabActive:O_,hint:z_,adminHint:A_};function B_({onClose:e}){const t=so(),n=fe(K1),r=fe(Y1),[o,l]=g.useState("login"),[i,a]=g.useState(""),[u,c]=g.useState(""),[d,f]=g.useState(""),[h,_]=g.useState(""),[w,v]=g.useState("");g.useEffect(()=>{function y(x){x.key==="Escape"&&e()}return document.addEventListener("keydown",y),()=>document.removeEventListener("keydown",y)},[e]),g.useEffect(()=>()=>{t(pc())},[t]);function S(y){l(y),v(""),t(pc())}async function p(y){if(y.preventDefault(),v(""),o==="register"){if(d!==h){v("Пароли не совпадают");return}await t(V1(u,d))&&e();return}await t(H1(i,d))&&e()}const m=w||r;return s.jsx("div",{className:X.overlay,onClick:e,children:s.jsxs("div",{className:X.modal,role:"dialog","aria-modal":"true","aria-label":o==="login"?"Вход":"Регистрация",onClick:y=>y.stopPropagation(),children:[s.jsx("button",{type:"button",className:X.close,onClick:e,"aria-label":"Закрыть",children:"×"}),s.jsxs("span",{className:X.eyebrow,children:["//",o==="login"?" авторизация":" регистрация"]}),s.jsx("h2",{className:X.title,children:o==="login"?"Вход":"Создать аккаунт"}),s.jsxs("div",{className:X.tabs,role:"tablist",children:[s.jsx("button",{type:"button",className:[X.tab,o==="login"?X.tabActive:""].filter(Boolean).join(" "),onClick:()=>S("login"),children:"Вход"}),s.jsx("button",{type:"button",className:[X.tab,o==="register"?X.tabActive:""].filter(Boolean).join(" "),onClick:()=>S("register"),children:"Регистрация"})]}),s.jsxs("form",{onSubmit:p,className:X.form,children:[o==="login"?s.jsxs("label",{className:X.field,children:[s.jsx("span",{className:X.label,children:"Email или логин"}),s.jsx("input",{className:X.input,value:i,onChange:y=>a(y.target.value),autoFocus:!0,autoComplete:"username",required:!0})]}):s.jsxs("label",{className:X.field,children:[s.jsx("span",{className:X.label,children:"Email"}),s.jsx("input",{className:X.input,type:"email",value:u,onChange:y=>c(y.target.value),autoFocus:!0,autoComplete:"email",required:!0})]}),s.jsxs("label",{className:X.field,children:[s.jsx("span",{className:X.label,children:"Пароль"}),s.jsx("input",{className:X.input,type:"password",value:d,onChange:y=>f(y.target.value),minLength:o==="register"?8:void 0,autoComplete:o==="register"?"new-password":"current-password",required:!0})]}),o==="register"&&s.jsxs("label",{className:X.field,children:[s.jsx("span",{className:X.label,children:"Повторите пароль"}),s.jsx("input",{className:X.input,type:"password",value:h,onChange:y=>_(y.target.value),minLength:8,autoComplete:"new-password",required:!0})]}),o==="register"&&s.jsx("p",{className:X.hint,children:"Минимум 8 символов. Пароль хранится в зашифрованном виде."}),m&&s.jsx("p",{className:X.error,children:m}),s.jsx("button",{type:"submit",className:X.submit,disabled:n,children:n?o==="register"?"Создаём...":"Проверяем...":o==="register"?"Зарегистрироваться":"Войти"})]}),o==="login"&&s.jsx("p",{className:X.adminHint,children:"Администратор также входит через эту форму по своему логину."})]})})}const F_="_wrapper_1190d_1",D_="_badge_1190d_7",U_="_logoutBtn_1190d_19",H_="_loginBtn_1190d_20",Ro={wrapper:F_,badge:D_,logoutBtn:U_,loginBtn:H_};function V_(){const e=so(),t=fe(Sn),n=fe(q1),r=fe(G1),[o,l]=g.useState(!1);return r?null:n?s.jsxs("div",{className:Ro.wrapper,children:[s.jsx("span",{className:Ro.badge,children:t?`[ админ: ${n.login} ]`:`[ ${n.email||n.login} ]`}),s.jsx("button",{type:"button",className:Ro.logoutBtn,onClick:()=>e(W1()),children:"выйти"})]}):s.jsxs(s.Fragment,{children:[s.jsx("button",{type:"button",className:Ro.loginBtn,onClick:()=>l(!0),children:"войти / регистрация"}),o&&s.jsx(B_,{onClose:()=>l(!1)})]})}const W_="_box_1eqha_1",Q_="_header_1eqha_21",q_="_progress_1eqha_44",K_="_progressFill_1eqha_58",G_="_info_1eqha_71",Y_="_status_1eqha_79",X_="_errorCount_1eqha_89",J_="_title_1eqha_130",Z_="_percent_1eqha_138",lt={box:W_,header:Q_,progress:q_,progressFill:K_,info:G_,status:Y_,errorCount:X_,title:J_,percent:Z_};function Rp({importId:e,onComplete:t}){const n=fe(lr),[r,o]=g.useState(null),[l,i]=g.useState("");return g.useEffect(()=>{if(!e)return;let a;async function u(){try{const c=await fetch(`/api/instructions/imports/${e}`,{headers:{Authorization:`Bearer ${n}`}});if(!c.ok)throw new Error("Не удалось получить статус импорта");const d=await c.json();o(d),d.status==="completed"&&(clearInterval(a),setTimeout(()=>{t&&t()},2e3)),d.status==="failed"&&clearInterval(a)}catch(c){i(c.message)}}return u(),a=setInterval(u,2e3),()=>{clearInterval(a)}},[e,n]),e?l?s.jsxs("div",{className:lt.box,children:["Ошибка:"," ",l]}):r?s.jsxs("div",{className:lt.box,children:[s.jsxs("div",{className:lt.header,children:[s.jsx("strong",{className:lt.title,children:"Импорт документов"}),s.jsxs("span",{className:lt.percent,children:[r.progress||0,"%"]})]}),s.jsx("div",{className:lt.progress,children:s.jsx("div",{className:lt.progressFill,style:{width:`${r.progress||0}%`}})}),s.jsxs("div",{className:lt.info,children:["Обработано:"," ",r.completed," / ",r.total]}),r.failed>0&&s.jsxs("div",{className:lt.errorCount,children:["Ошибок:"," ",r.failed]}),s.jsxs("div",{className:lt.status,children:["Статус:"," ",e0(r.status)]})]}):s.jsx("div",{className:lt.box,children:"Запуск импорта..."}):null}function e0(e){return{waiting:"ожидание",processing:"обработка",completed:"завершено",failed:"ошибка"}[e]||e}const t0="_header_xobq2_1",n0="_actions_xobq2_14",mc={header:t0,actions:n0};function Wa({query:e,onQueryChange:t}){return s.jsxs("header",{className:mc.header,children:[s.jsx(hl,{value:e,onChange:t}),s.jsxs("div",{className:mc.actions,children:[s.jsx(V_,{}),s.jsx(Rp,{}),s.jsx(yl,{})]})]})}const hc="cloudpayments-widget-script",r0="https://widget.cloudpayments.ru/bundles/cloudpayments.js";function o0(){var e;return(e=window.cp)!=null&&e.CloudPayments?Promise.resolve(window.cp):new Promise((t,n)=>{const r=document.getElementById(hc),o=()=>{var i;if((i=window.cp)!=null&&i.CloudPayments){t(window.cp);return}n(new Error("CloudPayments не инициализирован"))};if(r){r.addEventListener("load",o,{once:!0}),r.addEventListener("error",()=>{n(new Error("Не удалось загрузить форму оплаты"))},{once:!0});return}const l=document.createElement("script");l.id=hc,l.src=r0,l.async=!0,l.addEventListener("load",o,{once:!0}),l.addEventListener("error",()=>{n(new Error("Не удалось загрузить форму оплаты"))},{once:!0}),document.head.appendChild(l)})}const l0="_page_ek9q6_1",i0="_content_ek9q6_10",s0="_back_ek9q6_27",a0="_hero_ek9q6_60",u0="_heroCopy_ek9q6_82",c0="_eyebrow_ek9q6_88",d0="_title_ek9q6_109",f0="_lead_ek9q6_143",p0="_notice_ek9q6_161",m0="_priceCard_ek9q6_185",h0="_priceLabel_ek9q6_205",y0="_price_ek9q6_185",g0="_priceDescription_ek9q6_239",v0="_orderSection_ek9q6_254",_0="_orderIntro_ek9q6_270",w0="_orderNumber_ek9q6_279",x0="_orderTitle_ek9q6_294",S0="_orderText_ek9q6_315",k0="_form_ek9q6_333",E0="_label_ek9q6_345",j0="_input_ek9q6_367",C0="_summary_ek9q6_429",N0="_error_ek9q6_470",R0="_success_ek9q6_471",P0="_submit_ek9q6_518",L0="_paymentNote_ek9q6_596",I0="_siteHeader_ek9q6_673",$0="_heroProfile_ek9q6_965",T0="_generatedResult_ek9q6_1218",b0="_generatedResultHeader_ek9q6_1227",M0="_generatedResultEyebrow_ek9q6_1233",O0="_generatedResultTitle_ek9q6_1242",z0="_generatedResultText_ek9q6_1250",H={page:l0,content:i0,back:s0,hero:a0,heroCopy:u0,eyebrow:c0,title:d0,lead:f0,notice:p0,priceCard:m0,priceLabel:h0,price:y0,priceDescription:g0,orderSection:v0,orderIntro:_0,orderNumber:w0,orderTitle:x0,orderText:S0,form:k0,label:E0,input:j0,summary:C0,error:N0,success:R0,submit:P0,paymentNote:L0,siteHeader:I0,heroProfile:$0,generatedResult:T0,generatedResultHeader:b0,generatedResultEyebrow:M0,generatedResultTitle:O0,generatedResultText:z0};function A0(){const e=Zf(),[t,n]=g.useState(""),[r,o]=g.useState(""),[l,i]=g.useState(!1),[a,u]=g.useState(""),[c,d]=g.useState(!1),[f,h]=g.useState("");g.useLayoutEffect(()=>{window.scrollTo({top:0,left:0,behavior:"auto"}),document.documentElement.scrollTop=0,document.body.scrollTop=0},[]);async function x(k){var N;k.preventDefault(),u(""),h("");const E=t.trim();if(E.length<2){u("Укажите профессию, для которой нужна инструкция.");return}i(!0);try{const C=await fetch("/api/public-generation/orders",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profession:E})}),z=await C.json().catch(()=>({}));if(C.status===409&&(z!=null&&z.existingInstructionId)){e(`/instrukciya-po-ohrane-truda/${encodeURIComponent(z.existingInstructionId)}`);return}if(!C.ok)throw new Error((z==null?void 0:z.error)||(z==null?void 0:z.message)||"Не удалось создать заказ.");const{orderId:I,orderToken:A,externalId:Z,publicTerminalId:ae,amount:M,currency:W}=z;if(!I||!A||!ae||!Number.isFinite(Number(M))||Number(M)<=0||!W)throw new Error("Сервер вернул неполные данные платежа.");const ue=await o0(),R=await new ue.CloudPayments().start({publicTerminalId:ae,description:`Срочная инструкция по охране труда: ${E}`,paymentSchema:"Single",amount:Number(M),currency:W,culture:"ru-RU",skin:"classic",externalId:Z||I,successRedirectUrl:`https://boykovdocs.ru/thanks/?orderId=${encodeURIComponent(I)}`,failRedirectUrl:"https://boykovdocs.ru/srochnaya-generaciya-instrukcii"});if((R==null?void 0:R.status)!=="success"||!((N=R==null?void 0:R.data)!=null&&N.transactionId))throw new Error((R==null?void 0:R.message)||"Оплата не завершена.");const O=String(R.data.transactionId);d(!0),h("Платёж выполнен. Проверяем транзакцию в CloudPayments...");let T=!1,$=null;for(let P=0;P<8;P+=1){let B;try{B=await fetch(`/api/public-generation/orders/${encodeURIComponent(I)}/confirm-payment`,{method:"POST",headers:{"Content-Type":"application/json","x-order-token":A},body:JSON.stringify({transactionId:O})})}catch{await new Promise(ir=>setTimeout(ir,2e3));continue}const U=await B.json().catch(()=>({}));if(B.ok){T=!0,$=U;break}if(!(B.status===502||B.status===429||B.status===409&&String((U==null?void 0:U.error)??"").includes("пока не подтвердил"))){console.error("[UrgentGeneration] payment confirmation rejected:",B.status,U);break}await new Promise(ir=>setTimeout(ir,2e3))}if(!T){h("Платёж выполнен, но автоматическое подтверждение пока не получено. Повторно оплачивать не нужно.");return}window.location.replace(`/thanks/?orderId=${encodeURIComponent(I)}`);return;}catch(C){u((C==null?void 0:C.message)||"Оплата не завершена.")}finally{i(!1)}}return s.jsxs("div",{className:H.page,children:[s.jsx(Ha,{title:"Срочная инструкция по охране труда за 500 ₽ | БОЙКОВГРУПП",description:"Срочная подготовка проекта инструкции по охране труда для нужной профессии с опорой на требования законодательства РФ."}),s.jsxs("div",{className:H.siteHeader,children:[s.jsx(Wa,{query:r,onQueryChange:o}),s.jsx(Xr,{})]}),s.jsxs("main",{className:H.content,children:[s.jsx(Ve,{to:"/",className:H.back,children:"← Все инструкции"}),s.jsxs("section",{className:H.hero,children:[s.jsxs("div",{className:H.heroCopy,children:[s.jsx("div",{className:H.eyebrow,children:"[ срочная подготовка ]"}),s.jsx("h1",{className:H.title,children:"Срочная инструкция по охране труда"}),s.jsx("p",{className:H.lead,children:"Укажите профессию — подготовим проект инструкции с опорой на требования законодательства Российской Федерации и принятую структуру документов по охране труда."}),s.jsx("div",{className:H.notice,children:"Перед утверждением инструкции работодателем документ необходимо проверить с учётом конкретных условий труда, оборудования и локальных требований организации."})]}),s.jsx("div",{className:H.heroProfile,children:s.jsx(gl,{compact:!0})}),s.jsxs("div",{className:H.priceCard,children:[s.jsx("div",{className:H.priceLabel,children:"Стоимость"}),s.jsx("div",{className:H.price,children:"500 ₽"}),s.jsx("div",{className:H.priceDescription,children:"за подготовку одной инструкции"})]})]}),s.jsxs("section",{className:H.orderSection,children:[s.jsxs("div",{className:H.orderIntro,children:[s.jsx("div",{className:H.orderNumber,children:"01"}),s.jsxs("div",{children:[s.jsx("h2",{className:H.orderTitle,children:"Укажите профессию"}),s.jsx("p",{className:H.orderText,children:"Напишите точное название профессии или вида работ, для которых необходима инструкция."})]})]}),s.jsxs("form",{className:H.form,onSubmit:x,children:[s.jsx("label",{className:H.label,htmlFor:"urgent-profession",children:"Профессия"}),s.jsx("input",{id:"urgent-profession",className:H.input,type:"text",value:t,onChange:k=>{n(k.target.value),u("")},placeholder:"Например: электромонтёр по ремонту оборудования",autoComplete:"off",maxLength:180}),s.jsxs("div",{className:H.summary,children:[s.jsx("span",{children:"Срочная инструкция"}),s.jsx("strong",{children:"500 ₽"})]}),a&&s.jsx("div",{className:H.error,children:a}),c&&s.jsx("div",{className:H.success,children:f||"Проверяем состояние заказа..."}),s.jsx("button",{type:"submit",className:H.submit,disabled:l||c,children:l?"Открываем оплату...":c?"Оплачено":"Заказать инструкцию"}),s.jsxs("p",{className:H.paymentNote,children:["Сумма оплаты:"," ",s.jsx("strong",{children:"500 российских рублей"})]})]})]})]})]})}const B0="_hint_mag7y_1",F0="_visible_mag7y_52",D0="_eyebrow_mag7y_67",U0="_text_mag7y_88",H0="_price_mag7y_107",V0="_button_mag7y_127",En={hint:B0,visible:F0,eyebrow:D0,text:U0,price:H0,button:V0};function W0(){return null}const Q0="_page_d2gaj_1",q0="_siteHeader_d2gaj_5",K0="_content_d2gaj_11",G0="_description_d2gaj_23",Y0="_grid_d2gaj_28",X0="_card_d2gaj_35",jn={page:Q0,siteHeader:q0,content:K0,description:G0,grid:Y0,card:X0};function J0(){
const[e,t]=g.useState([]),
[n,r]=g.useState(!0),
[o,l]=g.useState(1),
[i,a]=g.useState(1),
[u,c]=g.useState("");

g.useEffect(()=>{
let d=!1;

async function f(){
try{
r(!0);
c("");

const h=await fetch(
`/api/instructions?page=${o}&pageSize=11`
);

const v=await h.json()
.catch(()=>({}));

if(!h.ok){
throw new Error(
v?.error||
"Не удалось загрузить инструкции."
);
}

if(!d){
t(
Array.isArray(v?.items)
?v.items
:[]
);

a(
Math.max(
1,
Number(v?.totalPages)||1
)
);
}
}
catch(h){
if(!d){
c(
h?.message||
"Не удалось загрузить инструкции."
);
}
}
finally{
if(!d){
r(!1);
}
}
}

f();

return()=>{
d=!0;
};
},[o]);


function d(f){
if(
f<1||
f>i||
f===o
){
return;
}

l(f);

window.scrollTo({
top:0,
behavior:"smooth"
});
}


const f=(()=>{
if(i<=7){
return Array.from(
{length:i},
(h,v)=>v+1
);
}

const h=[1];

if(o>4){
h.push("left");
}

const v=Math.max(
2,
o-2
);

const S=Math.min(
i-1,
o+2
);

for(
let p=v;
p<=S;
p+=1
){
h.push(p);
}

if(o<i-3){
h.push("right");
}

h.push(i);

return h;
})();


return s.jsxs(
"div",
{
className:jn.page,

children:[

s.jsx(
Ha,
{
title:
"Инструкции по охране труда | БОЙКОВГРУПП",

description:
"Готовые инструкции по охране труда для различных профессий. База документов по охране труда для организаций."
}
),

s.jsxs(
"div",
{
className:jn.siteHeader,

children:[
s.jsx(
Wa,
{
query:"",
onQueryChange:()=>{}
}
),

s.jsx(
Xr,
{}
)
]
}
),

s.jsxs(
"main",
{
className:jn.content,

children:[

s.jsx(
"h1",
{
children:
"Инструкции по охране труда"
}
),

s.jsx(
"p",
{
className:jn.description,

children:
"Готовые инструкции по охране труда для работников различных профессий."
}
),

n&&s.jsx(
"p",
{
className:
"catalogLoading",

children:
"Загрузка..."
}
),

u&&s.jsx(
"p",
{
className:
"catalogError",

children:u
}
),

!n&&!u&&s.jsxs(
s.Fragment,
{
children:[

s.jsxs(
"div",
{
className:jn.grid,

children:[

...e.map(
h=>
s.jsxs(
Ve,
{
to:
`/instrukciya-po-ohrane-truda/${h.id}`,

className:
jn.card,

children:[
s.jsx(
"h2",
{
children:h.title
}
),

s.jsx(
"span",
{
children:
"Открыть инструкцию →"
}
)
]
},
h.id
)
),

s.jsxs(
"div",
{
className:"generationCatalogCard generationCatalogStandalone",

children:[

s.jsx(
"div",
{
className:
"generationCatalogEyebrow",

children:
"Нужной инструкции нет?"
}
),

s.jsx(
"h2",
{
className:
"generationCatalogTitle",

children:
"Не нашли нужную инструкцию?"
}
),

s.jsx(
"p",
{
className:
"generationCatalogText",

children:
"Сгенерируйте её!"
}
),

s.jsx(
Ve,
{
to:
"/srochnaya-generaciya-instrukcii",

className:
"generationCatalogButton",

children:
"Сгенерировать"
}
)

]
},
"generation-card"
)

]
}
),


i>1&&s.jsxs(
"nav",
{
className:
"catalogPagination",

"aria-label":
"Пагинация инструкций",

children:[

s.jsx(
"button",
{
type:"button",

className:
"catalogPaginationArrow",

disabled:o===1,

onClick:()=>
d(o-1),

"aria-label":
"Предыдущая страница",

children:"←"
}
),

...f.map(
(h,v)=>
typeof h==="number"
?s.jsx(
"button",
{
type:"button",

className:
[
"catalogPaginationPage",
h===o
?"catalogPaginationPageActive"
:""
]
.filter(Boolean)
.join(" "),

onClick:()=>
d(h),

"aria-current":
h===o
?"page"
:void 0,

children:h
},
`page-${h}`
)
:s.jsx(
"span",
{
className:
"catalogPaginationDots",

children:"…"
},
`dots-${h}-${v}`
)
),

s.jsx(
"button",
{
type:"button",

className:
"catalogPaginationArrow",

disabled:o===i,

onClick:()=>
d(o+1),

"aria-label":
"Следующая страница",

children:"→"
}
)

]
}
)

]
}
)

]
}
)

]
}
);
}const Z0="_card_zhccd_1",ew="_clickArea_zhccd_11",tw="_index_zhccd_53",nw="_body_zhccd_72",rw="_title_zhccd_82",ow="_arrow_zhccd_91",lw="_adminBar_zhccd_109",iw="_adminBtn_zhccd_118",sw="_confirmRow_zhccd_133",aw="_confirmLabel_zhccd_141",uw="_confirmYes_zhccd_145",cw="_confirmNo_zhccd_146",Be={card:Z0,clickArea:ew,index:tw,body:nw,title:rw,arrow:ow,adminBar:lw,adminBtn:iw,confirmRow:sw,confirmLabel:aw,confirmYes:uw,confirmNo:cw};function dw({instruction:e,isAdmin:t,onDelete:n,onEdit:r,isDeleting:o}){const[l,i]=g.useState(!1);return s.jsxs("div",{className:Be.card,children:[s.jsxs(Ve,{className:Be.clickArea,to:`/instrukciya-po-ohrane-truda/${e.id}`,children:[s.jsx("span",{className:Be.index,"aria-hidden":"true"}),s.jsx("span",{className:Be.body,children:s.jsx("span",{className:Be.title,children:e.title})}),s.jsx("span",{className:Be.arrow,"aria-hidden":"true",children:"→"})]}),t&&s.jsxs("div",{className:Be.adminBar,children:[s.jsx("button",{type:"button",className:Be.adminBtn,onClick:()=>r(e),children:"[ редактировать ]"}),l?s.jsxs("span",{className:Be.confirmRow,children:[s.jsx("span",{className:Be.confirmLabel,children:"удалить статью?"}),s.jsx("button",{type:"button",className:Be.confirmYes,disabled:o,onClick:()=>n(e.id),children:o?"...":"да"}),s.jsx("button",{type:"button",className:Be.confirmNo,onClick:()=>i(!1),children:"нет"})]}):s.jsx("button",{type:"button",className:Be.adminBtn,onClick:()=>i(!0),children:"[ удалить ]"})]})]})}const fw="_list_x5ka0_1",pw="_item_x5ka0_30",mw="_visible_x5ka0_73",bs={list:fw,item:pw,visible:mw};function hw({children:e,delay:t=0}){const n=g.useRef(null),[r,o]=g.useState(!1);return g.useEffect(()=>{var u,c;const l=n.current;if(!l)return;if(((c=(u=window.matchMedia)==null?void 0:u.call(window,"(prefers-reduced-motion: reduce)"))==null?void 0:c.matches)||typeof IntersectionObserver>"u"){o(!0);return}const a=new IntersectionObserver(([d])=>{d.isIntersecting&&(o(!0),a.unobserve(d.target))},{threshold:.06,rootMargin:"0px 0px -2% 0px"});return a.observe(l),()=>{a.disconnect()}},[]),s.jsx("li",{ref:n,className:[bs.item,r?bs.visible:""].filter(Boolean).join(" "),style:{"--reveal-delay":`${t}ms`},children:e})}function yw({
instructions:e,
total:t=0,
query:n="",
isAdmin:r,
onDelete:o,
deletingId:l,
onEdit:i
}){

const[a,u]=g.useState(1),
[c,d]=g.useState(
Array.isArray(e)
?e.slice(0,11)
:[]
),
[f,h]=g.useState(!1),
[_,w]=g.useState("");

const v=Math.max(
1,
Math.ceil(
(
Number(t)||
(Array.isArray(e)?e.length:0)
)/11
)
);


g.useEffect(()=>{
u(1);
w("");
},[n]);


g.useEffect(()=>{
if(
a===1&&
Array.isArray(e)
){
d(
e.slice(0,11)
);
}
},[e,a]);


async function S(p){

if(
p<1||
p>v||
p===a||
f
){
return;
}

h(!0);
w("");

try{

if(p===1){

d(
Array.isArray(e)
?e.slice(0,11)
:[]
);

u(1);

}
else{

const m=new URLSearchParams({
q:n||"",
page:String(p),
pageSize:"11"
});

const y=await fetch(
`/api/instructions?${m.toString()}`
);

const x=await y
.json()
.catch(()=>({}));

if(!y.ok){
throw new Error(
x?.error||
"Не удалось загрузить страницу."
);
}

d(
Array.isArray(x?.items)
?x.items
:[]
);

u(p);

}

window.scrollTo({
top:0,
behavior:"smooth"
});

}
catch(p){

w(
p?.message||
"Не удалось загрузить страницу."
);

}
finally{

h(!1);

}
}


function p(){

if(v<=7){

return Array.from(
{length:v},
(m,y)=>y+1
);

}

const m=[1];

if(a>4){
m.push("left");
}

const y=Math.max(
2,
a-2
);

const x=Math.min(
v-1,
a+2
);

for(
let k=y;
k<=x;
k+=1
){
m.push(k);
}

if(a<v-3){
m.push("right");
}

m.push(v);

return m;
}


const m=p();


return s.jsxs(
s.Fragment,
{
children:[

s.jsxs(
"ul",
{
className:bs.list,

children:[

...c.map(
(y,x)=>
s.jsx(
hw,
{
delay:x%3*90,

children:
s.jsx(
dw,
{
instruction:y,
isAdmin:r,
onDelete:o,
onEdit:i,
isDeleting:l===y.id
}
)
},
y.id
)
),


s.jsx(
hw,
{
delay:c.length%3*90,

children:
s.jsxs(
"div",
{
className:
`${Be.card} generationListCard`,

children:[

s.jsxs(
"div",
{
className:
`${Be.clickArea} generationListCardInner`,

children:[



s.jsxs(
"span",
{
className:
`${Be.body} generationListBody`,

children:[

s.jsx(
"span",
{
className:
"generationListEyebrow",

children:
"[ своя инструкция ]"
}
),

s.jsx(
"span",
{
className:
`${Be.title} generationListTitle`,

children:
"Не нашли нужную инструкцию?"
}
),

s.jsx(
"span",
{
className:
"generationListText",

children:
"Сгенерируйте её!"
}
),

s.jsx(
Ve,
{
to:
"/srochnaya-generaciya-instrukcii",

className:
"generationListButton",

children:
"Сгенерировать"
}
)

]
}
)

]
}
)

]
}
)
},
"generation-card"
)

]
}
),


_&&s.jsx(
"p",
{
className:
"realPaginationError",

children:_
}
),


v>1&&s.jsxs(
"nav",
{
className:
"realCatalogPagination",

"aria-label":
"Страницы каталога инструкций",

children:[

s.jsx(
"button",
{
type:"button",

className:
"realPaginationArrow",

disabled:
a===1||f,

onClick:()=>
S(a-1),

"aria-label":
"Предыдущая страница",

children:"←"
}
),


...m.map(
(y,x)=>
typeof y==="number"
?
s.jsx(
"button",
{
type:"button",

disabled:f,

className:[
"realPaginationPage",
y===a
?"realPaginationPageActive"
:""
]
.filter(Boolean)
.join(" "),

onClick:()=>
S(y),

"aria-current":
y===a
?"page"
:void 0,

children:y
},
`page-${y}`
)
:
s.jsx(
"span",
{
className:
"realPaginationDots",

children:"…"
},
`dots-${y}-${x}`
)
),


s.jsx(
"button",
{
type:"button",

className:
"realPaginationArrow",

disabled:
a===v||f,

onClick:()=>
S(a+1),

"aria-label":
"Следующая страница",

children:"→"
}
)

]
}
),


f&&s.jsx(
"div",
{
className:
"realPaginationLoading",

children:
"Загрузка..."
}
)

]
}
);
}const gw="_wrapper_1ubev_1",vw="_cursor_1ubev_12",yc={wrapper:gw,cursor:vw};function _w({label:e="Загрузка..."}){return s.jsxs("div",{className:yc.wrapper,role:"status",children:[s.jsx("span",{children:e}),s.jsx("span",{className:yc.cursor,"aria-hidden":"true"})]})}const ww="_wrapper_1wb71_1",xw="_iconWrap_1wb71_11",Sw="_text_1wb71_23",kw="_button_1wb71_29",Ew="_error_1wb71_54",jw="_hint_1wb71_60",Cn={wrapper:ww,iconWrap:xw,text:Sw,button:kw,error:Ew,hint:jw};function Cw({query:e,isAdmin:t,isGenerating:n,error:r,onGenerate:o}){return s.jsxs("div",{className:Cn.wrapper,children:[s.jsx("div",{className:Cn.iconWrap,"aria-hidden":"true",children:s.jsxs("svg",{width:"20",height:"20",viewBox:"0 0 24 24",fill:"none",children:[s.jsx("circle",{cx:"11",cy:"11",r:"7",stroke:"currentColor",strokeWidth:"2"}),s.jsx("line",{x1:"16.5",y1:"16.5",x2:"21",y2:"21",stroke:"currentColor",strokeWidth:"2",strokeLinecap:"round"})]})}),s.jsxs("p",{className:Cn.text,children:["  ",e,"   "]}),t?s.jsxs(s.Fragment,{children:[s.jsx("button",{type:"button",className:Cn.button,onClick:o,disabled:n,children:n?" ...":"  YandexGPT"}),r&&s.jsx("p",{className:Cn.error,children:r})]}):s.jsx("p",{className:Cn.hint,children:"."})]})}function Nw(e,t=350){const[n,r]=g.useState(e);return g.useEffect(()=>{const o=setTimeout(()=>r(e),t);return()=>clearTimeout(o)},[e,t]),n}const Rw="";async function nt(e,t={}){const{headers:n,...r}=t,o=typeof FormData<"u"&&r.body instanceof FormData,l=await fetch(`${Rw}${e}`,{headers:o?{...n}:{"Content-Type":"application/json",...n},...r});if(!l.ok){let i=`Ошибка запроса (${l.status})`;try{const a=await l.json();a!=null&&a.error&&(i=a.error)}catch{}throw new Error(i)}return l.status===204?null:l.json()}function pt(e){return e?{Authorization:`Bearer ${e}`}:{}}function Pw({query:e="",page:t=1,pageSize:n=6}={}){const r=new URLSearchParams({q:e,page:String(t),pageSize:String(n)});return nt(`/api/instructions?${r.toString()}`)}function Lw(e,t){return nt("/api/instructions/generate",{method:"POST",headers:pt(t),body:JSON.stringify({profession:e})})}function Iw(e,t){return nt("/api/instructions/upload",{method:"POST",headers:pt(t),body:e})}function $w(e){return nt("/api/instructions/generation-stats",{headers:pt(e)})}function Tw(e,t){return nt(`/api/instructions/${encodeURIComponent(e)}`,{method:"DELETE",headers:pt(t)})}function bw(e,t){return nt("/api/instructions/import-batches",{method:"POST",headers:pt(t),body:JSON.stringify({total:e})})}function Mw(e,t,n){const r=new FormData;for(const o of t)r.append("files",o);return nt(`/api/instructions/import-batches/${encodeURIComponent(e)}/files`,{method:"POST",headers:pt(n),body:r})}function Ow(e,t){return nt(`/api/instructions/import-batches/${encodeURIComponent(e)}/start`,{method:"POST",headers:pt(t)})}function gc(e,t){return nt(`/api/instructions/import-batches/${encodeURIComponent(e)}`,{headers:pt(t)})}function zw(e,t,{status:n="",offset:r=0,limit:o=100}={}){const l=new URLSearchParams;return n&&l.set("status",n),l.set("offset",String(r)),l.set("limit",String(o)),nt(`/api/instructions/import-batches/${encodeURIComponent(e)}/files?${l.toString()}`,{headers:pt(t)})}function Aw(e,t){return nt(`/api/instructions/import-batches/${encodeURIComponent(e)}/stop`,{method:"POST",headers:pt(t)})}function Bw(e,t){return nt(`/api/instructions/import-batches/${encodeURIComponent(e)}/resume`,{method:"POST",headers:pt(t)})}const dn=11,Pp="instructions/searchStart",Lp="instructions/searchSuccess",Ip="instructions/searchFail",Fw="instructions/selectStart",Dw="instructions/selectSuccess",Uw="instructions/selectFail",Hw="instructions/selectClear",$p="instructions/generateStart",Tp="instructions/generateSuccess",bp="instructions/generateFail",Mp="instructions/uploadStart",Op="instructions/uploadSuccess",zp="instructions/uploadFail",Ap="instructions/deleteStart",Bp="instructions/deleteSuccess",Fp="instructions/deleteFail",Vw={items:[],total:0,page:1,totalPages:1,query:"",isSearching:!0,isLoadingMore:!1,searchError:null,loadMoreError:null,selected:null,isLoadingSelected:!1,selectedError:null,isGenerating:!1,generateError:null,isUploading:!1,uploadError:null,deletingId:null,deleteError:null};function Ww(e=Vw,t){var n,r,o,l,i,a,u,c;switch(t.type){case Pp:{const d=((n=t.meta)==null?void 0:n.append)===!0;return{...e,isSearching:!d,isLoadingMore:d,searchError:d?e.searchError:null,loadMoreError:null,query:d?e.query:((r=t.meta)==null?void 0:r.query)??""}}case Lp:{if(((o=t.meta)==null?void 0:o.query)!==e.query)return e;const d=((l=t.meta)==null?void 0:l.append)===!0,f=Array.isArray((i=t.payload)==null?void 0:i.items)?t.payload.items:[];let h=f;if(d){const _=new Map;for(const w of[...e.items,...f])_.set(w.id,w);h=Array.from(_.values())}return{...e,isSearching:!1,isLoadingMore:!1,searchError:null,loadMoreError:null,items:h,total:t.payload.total,page:t.payload.page,totalPages:t.payload.totalPages,query:t.meta.query}}case Ip:return((a=t.meta)==null?void 0:a.query)!==e.query?e:((u=t.meta)==null?void 0:u.append)===!0?{...e,isLoadingMore:!1,loadMoreError:t.payload}:{...e,isSearching:!1,isLoadingMore:!1,searchError:t.payload,loadMoreError:null};case Fw:return{...e,isLoadingSelected:!0,selectedError:null,selected:null};case Dw:return{...e,isLoadingSelected:!1,selected:t.payload};case Uw:return{...e,isLoadingSelected:!1,selectedError:t.payload};case Hw:return{...e,selected:null,selectedError:null,isLoadingSelected:!1};case $p:return{...e,isGenerating:!0,generateError:null};case Tp:return{...e,isGenerating:!1,selected:t.payload};case bp:return{...e,isGenerating:!1,generateError:t.payload};case Mp:return{...e,isUploading:!0,uploadError:null};case Op:return{...e,isUploading:!1,selected:t.payload};case zp:return{...e,isUploading:!1,uploadError:t.payload};case Ap:return{...e,deletingId:t.payload,deleteError:null};case Bp:{const d=e.items.filter(f=>f.id!==t.payload);return{...e,deletingId:null,items:d,total:Math.max(0,e.total-1),selected:((c=e.selected)==null?void 0:c.id)===t.payload?null:e.selected}}case Fp:return{...e,deletingId:null,deleteError:t.payload};default:return e}}function fn({query:e="",page:t=1,pageSize:n=dn,append:r=!1}={}){return async o=>{o({type:Pp,meta:{query:e,append:r}});try{const l=await Pw({query:e,page:t,pageSize:n});return o({type:Lp,payload:l,meta:{query:e,append:r}}),l}catch(l){return o({type:Ip,payload:l.message,meta:{query:e,append:r}}),null}}}function Dp(e){return async(t,n)=>{t({type:$p});try{const r=lr(n()),o=await Lw(e,r);t({type:Tp,payload:o});const{query:l}=n().instructions;return t(fn({query:l,page:1,pageSize:dn})),o}catch(r){return t({type:bp,payload:r.message}),null}}}function Qw(e){return async(t,n)=>{t({type:Mp});try{const r=lr(n()),o=await Iw(e,r);t({type:Op,payload:o});const{query:l}=n().instructions;return t(fn({query:l,page:1,pageSize:dn})),o}catch(r){return t({type:zp,payload:r.message}),null}}}function qw(e){return async(t,n)=>{t({type:Ap,payload:e});try{const r=lr(n());await Tw(e,r),t({type:Bp,payload:e})}catch(r){t({type:Fp,payload:r.message})}}}const Kw="_page_znied_1",Gw="_hero_znied_7",Yw="_heroText_znied_15",Xw="_title_znied_19",Jw="_subtitle_znied_28",Zw="_resultsHead_znied_35",ex="_count_znied_43",tx="_error_znied_50",nx="_loadMoreZone_znied_67",rx="_loadMoreText_znied_78",ox="_loadMoreDone_znied_79",lx="_loadMoreRetry_znied_80",ix="_stickyIntro_znied_162",sx="_stickyIntroCompact_znied_222",ax="_compactControls_znied_241",ux="_compactSearch_znied_322",cx="_compactLogo_znied_327",dx="_heroPortraitWrap_znied_533",fx="_stickyTrigger_znied_728",px="_safeCompactHeader_znied_2066",mx="_safeCompactHeaderVisible_znied_2107",hx="_safeCompactInner_znied_2122",q={page:Kw,hero:Gw,heroText:Yw,title:Xw,subtitle:Jw,resultsHead:Zw,count:ex,error:tx,loadMoreZone:nx,loadMoreText:rx,loadMoreDone:ox,loadMoreRetry:lx,stickyIntro:ix,stickyIntroCompact:sx,compactControls:ax,compactSearch:ux,compactLogo:cx,heroPortraitWrap:dx,stickyTrigger:fx,safeCompactHeader:px,safeCompactHeaderVisible:mx,safeCompactInner:hx},yx="_addBtn_1etcv_1",gx="_plus_1etcv_24",vx="_overlay_1etcv_32",_x="_modal_1etcv_44",wx="_close_1etcv_67",xx="_title_1etcv_100",Sx="_form_1etcv_115",kx="_field_1etcv_121",Ex="_label_1etcv_127",jx="_textarea_1etcv_154",Cx="_fileInput_1etcv_174",Nx="_fileHint_1etcv_181",Rx="_modeSwitch_1etcv_187",Px="_modeBtn_1etcv_194",Lx="_modeBtnActive_1etcv_195",Ix="_submit_1etcv_227",$x="_error_1etcv_253",Tx="_wrapper_1etcv_278",bx="_bulkPanel_1etcv_302",Mx="_bulkStatus_1etcv_309",Ox="_bulkId_1etcv_314",zx="_progressLabel_1etcv_320",Ax="_progressTrack_1etcv_325",Bx="_progressBar_1etcv_333",Fx="_bulkStats_1etcv_341",Dx="_failedFiles_1etcv_348",Ux="_failedFile_1etcv_348",Hx="_bulkActions_1etcv_371",Vx="_stopButton_1etcv_377",Wx="_secondaryButton_1etcv_378",F={addBtn:yx,plus:gx,overlay:vx,modal:_x,close:wx,title:xx,form:Sx,field:kx,label:Ex,textarea:jx,fileInput:Cx,fileHint:Nx,modeSwitch:Rx,modeBtn:Px,modeBtnActive:Lx,submit:Ix,error:$x,wrapper:Tx,bulkPanel:bx,bulkStatus:Mx,bulkId:Ox,progressLabel:zx,progressTrack:Ax,progressBar:Bx,bulkStats:Fx,failedFiles:Dx,failedFile:Ux,bulkActions:Hx,stopButton:Vx,secondaryButton:Wx},Qx=".pdf,.doc,.docx,.txt,.md",qx=15*1024*1024,vc=5e3,Kx=20,Gx=40*1024*1024,Yx=700,rn="boykovdocs_active_bulk_import_id";function Xx(e){return new Promise(t=>setTimeout(t,e))}function Jx(e){const t=[];let n=[],r=0;for(const o of e)n.length>0&&(n.length>=Kx||r+o.size>Gx)&&(t.push(n),n=[],r=0),n.push(o),r+=o.size;return n.length&&t.push(n),t}function Zx(e,t){switch(e){case"creating":return"Создание пакетного импорта...";case"uploading":return"Загрузка файлов на сервер...";case"starting":return"Запуск обработки...";case"processing":return"Обработка документов...";case"stopping":return"Останавливаем импорт...";case"paused":return"Импорт остановлен";case"completed":return t!=null&&t.failed?"Импорт завершён с ошибками":"Импорт успешно завершён";case"error":return"Ошибка массового импорта";default:return""}}function eS({onClose:e,onImportCreated:t}){const n=so(),r=fe(lr),o=fe(P=>P.instructions.isUploading),l=fe(P=>P.instructions.uploadError),i=fe(P=>P.instructions.query),[a,u]=g.useState("file"),[c,d]=g.useState(""),[f,h]=g.useState([]),[_,w]=g.useState("idle"),[v,S]=g.useState(null),[p,m]=g.useState(0),[y,x]=g.useState(null),[k,E]=g.useState(null),[N,C]=g.useState([]),z=g.useRef(null),I=g.useRef(0),A=["creating","uploading","starting","processing","stopping"].includes(_),Z=a==="file"?f.length>0:c.trim().length>0;async function ae(P){try{const B=await zw(P,r,{status:"failed",limit:200});C((B==null?void 0:B.items)||[])}catch{}}async function M(P){const B=++I.current;for(;B===I.current;){const U=await gc(P,r);if(B!==I.current)return;if(x(U),U.status==="completed"){w("completed"),localStorage.removeItem(rn),await ae(P),n(fn({query:i,page:1}));return}if(U.status==="paused"){w("paused");return}w("processing"),await Xx(Yx)}}g.useEffect(()=>{if(!r)return;const P=localStorage.getItem(rn);if(!P)return;let B=!1;return(async()=>{try{const U=await gc(P,r);if(B)return;if(S(P),x(U),U.status==="completed"){w("completed"),localStorage.removeItem(rn),await ae(P);return}if(U.status==="paused"){w("paused");return}if(U.status==="running"){w("processing"),await M(P);return}localStorage.removeItem(rn)}catch{localStorage.removeItem(rn)}})(),()=>{B=!0,I.current++}},[r]),g.useEffect(()=>{function P(B){B.key==="Escape"&&!A&&!o&&e()}return document.addEventListener("keydown",P),()=>{document.removeEventListener("keydown",P)}},[e,A,o]);function W(){if(f.length>vc)throw new Error(`За один импорт можно выбрать не более ${vc} файлов`);const P=f.find(B=>B.size>qx);if(P)throw new Error(`Файл "${P.name}" превышает лимит 15 МБ`)}async function ue(){W(),E(null),C([]),m(0),x(null),w("creating");const P=await bw(f.length,r),B=P.id;S(B),x(P),w("uploading");const U=Jx(f);let mt=0;for(const Qa of U){const Wp=await Mw(B,Qa,r);mt+=Qa.length,m(mt),x(Wp)}w("starting");const ir=await Ow(B,r);x(ir),localStorage.setItem(rn,B),w("processing"),await M(B)}async function ze(){const P=new FormData;P.append("content",c.trim());const B=await n(Qw(P));B!=null&&B.importId&&t(B.importId)}async function R(P){if(P.preventDefault(),!(!Z||A||o))try{a==="file"?await ue():await ze()}catch(B){console.error("Bulk import error:",B),E((B==null?void 0:B.message)||"Ошибка массового импорта"),w("error")}}async function O(){if(!(!v||_!=="processing"))try{w("stopping");const P=await Aw(v,r);I.current++,x(P),w("paused")}catch(P){E((P==null?void 0:P.message)||"Не удалось остановить импорт"),w("error")}}async function T(){if(!(!v||_!=="paused"))try{E(null);const P=await Bw(v,r);x(P),localStorage.setItem(rn,v),w("processing"),await M(v)}catch(P){E((P==null?void 0:P.message)||"Не удалось продолжить импорт"),w("error")}}const $=((y==null?void 0:y.completed)||0)+((y==null?void 0:y.failed)||0),Q=(y==null?void 0:y.total)||f.length||0,Ae=Zx(_,y);return s.jsx("div",{className:F.overlay,onClick:()=>{!A&&!o&&e()},children:s.jsxs("div",{className:F.modal,role:"dialog","aria-modal":"true",onClick:P=>P.stopPropagation(),children:[s.jsx("button",{type:"button",className:F.close,disabled:A||o,onClick:e,children:"×"}),s.jsx("h2",{className:F.title,children:"Добавить инструкцию"}),_==="idle"?s.jsxs(s.Fragment,{children:[s.jsxs("div",{className:F.modeSwitch,children:[s.jsx("button",{type:"button",className:a==="file"?F.modeBtnActive:F.modeBtn,onClick:()=>u("file"),children:"Файлы"}),s.jsx("button",{type:"button",className:a==="text"?F.modeBtnActive:F.modeBtn,onClick:()=>u("text"),children:"Текст"})]}),s.jsxs("form",{onSubmit:R,className:F.form,children:[a==="file"?s.jsxs("label",{className:F.field,children:[s.jsx("span",{className:F.label,children:"Выберите документы"}),s.jsx("input",{ref:z,className:F.fileInput,type:"file",multiple:!0,accept:Qx,onChange:P=>{E(null),h(Array.from(P.target.files||[]))}}),f.length>0&&s.jsxs("div",{className:F.fileHint,children:["Выбрано файлов:"," ",f.length]})]}):s.jsxs("label",{className:F.field,children:[s.jsx("span",{className:F.label,children:"Текст инструкции"}),s.jsx("textarea",{className:F.textarea,value:c,onChange:P=>d(P.target.value),rows:8})]}),(k||l)&&s.jsx("p",{className:F.error,children:k||l}),s.jsx("button",{type:"submit",className:F.submit,disabled:o||A||!Z,children:o?"Загрузка...":a==="file"?`Импортировать ${f.length||""}`:"Добавить"})]})]}):s.jsxs("div",{className:F.bulkPanel,children:[s.jsx("div",{className:F.bulkStatus,children:Ae}),v&&s.jsxs("div",{className:F.bulkId,children:["ID: ",v]}),_==="uploading"&&s.jsxs(s.Fragment,{children:[s.jsxs("div",{className:F.progressLabel,children:["Загружено на сервер:"," ",p," / ",f.length]}),s.jsx("div",{className:F.progressTrack,children:s.jsx("div",{className:F.progressBar,style:{width:`${f.length?Math.round(p/f.length*100):0}%`}})})]}),["starting","processing","stopping","paused","completed"].includes(_)&&y&&s.jsxs(s.Fragment,{children:[s.jsxs("div",{className:F.progressLabel,children:["Обработано:"," ",$," / ",Q]}),s.jsx("div",{className:F.progressTrack,children:s.jsx("div",{className:F.progressBar,style:{width:`${y.progress||0}%`}})}),s.jsxs("div",{className:F.bulkStats,children:[s.jsxs("div",{children:["В очереди:"," ",s.jsx("strong",{children:y.waiting||0})]}),s.jsxs("div",{children:["Обрабатывается:"," ",s.jsx("strong",{children:y.processing||0})]}),s.jsxs("div",{children:["Успешно:"," ",s.jsx("strong",{children:y.completed||0})]}),s.jsxs("div",{children:["Ошибок:"," ",s.jsx("strong",{children:y.failed||0})]}),s.jsxs("div",{children:["Новых:"," ",s.jsx("strong",{children:y.created||0})]}),s.jsxs("div",{children:["Дубликатов:"," ",s.jsx("strong",{children:y.duplicates||0})]}),s.jsxs("div",{children:["Новых версий:"," ",s.jsx("strong",{children:y.updatedVersions||0})]})]})]}),k&&s.jsx("p",{className:F.error,children:k}),N.length>0&&s.jsxs("div",{className:F.failedFiles,children:[s.jsx("strong",{children:"Ошибки файлов"}),N.map(P=>s.jsxs("div",{className:F.failedFile,children:[s.jsx("div",{children:P.name}),s.jsx("div",{children:P.error||"Ошибка обработки"})]},P.id))]}),s.jsxs("div",{className:F.bulkActions,children:[_==="processing"&&s.jsx("button",{type:"button",className:F.stopButton,onClick:O,children:"Остановить импорт"}),_==="paused"&&s.jsx("button",{type:"button",className:F.submit,onClick:T,children:"Продолжить импорт"}),["completed","error","paused"].includes(_)&&s.jsx("button",{type:"button",className:F.secondaryButton,onClick:e,children:"Закрыть"})]})]})]})})}function tS({onImportCreated:e}){const t=fe(Sn),[n,r]=g.useState(!1);return t?s.jsxs("div",{className:F.wrapper,children:[s.jsxs("button",{type:"button",className:F.addBtn,onClick:()=>r(!0),children:[s.jsx("span",{className:F.plus,children:"+"}),"добавить инструкцию"]}),n&&s.jsx(eS,{onClose:()=>r(!1),onImportCreated:o=>{e(o),r(!1)}})]}):null}const nS="_generateBtn_c1jg1_1",rS="_plus_c1jg1_24",oS="_overlay_c1jg1_32",lS="_modal_c1jg1_44",iS="_close_c1jg1_67",sS="_eyebrow_c1jg1_91",aS="_title_c1jg1_100",uS="_hint_c1jg1_108",cS="_form_c1jg1_115",dS="_field_c1jg1_121",fS="_label_c1jg1_127",pS="_input_c1jg1_136",mS="_submit_c1jg1_154",hS="_error_c1jg1_180",Ie={generateBtn:nS,plus:rS,overlay:oS,modal:lS,close:iS,eyebrow:sS,title:aS,hint:uS,form:cS,field:dS,label:fS,input:pS,submit:mS,error:hS};function yS({onClose:e}){const t=so(),n=fe(a=>a.instructions.isGenerating),r=fe(a=>a.instructions.generateError),[o,l]=g.useState("");g.useEffect(()=>{function a(u){u.key==="Escape"&&e()}return document.addEventListener("keydown",a),()=>{document.removeEventListener("keydown",a)}},[e]);async function i(a){if(a.preventDefault(),!o.trim())return;await t(Dp(o.trim()))&&e()}return s.jsx("div",{className:Ie.overlay,onClick:e,children:s.jsxs("div",{className:Ie.modal,role:"dialog","aria-modal":"true",onClick:a=>a.stopPropagation(),children:[s.jsx("button",{type:"button",className:Ie.close,onClick:e,"aria-label":"Закрыть",children:"×"}),s.jsx("span",{className:Ie.eyebrow,children:"// AI GENERATION"}),s.jsx("h2",{className:Ie.title,children:"Генерация через YandexGPT"}),s.jsx("p",{className:Ie.hint,children:"Введите профессию, для которой необходимо создать инструкцию по охране труда."}),s.jsxs("form",{onSubmit:i,className:Ie.form,children:[s.jsxs("label",{className:Ie.field,children:[s.jsx("span",{className:Ie.label,children:"Профессия"}),s.jsx("input",{className:Ie.input,value:o,onChange:a=>l(a.target.value),placeholder:"Например: сварщик",autoFocus:!0,required:!0})]}),r&&s.jsx("p",{className:Ie.error,children:r}),s.jsx("button",{type:"submit",className:Ie.submit,disabled:n||!o.trim(),children:n?"Генерация...":"Создать инструкцию"})]})]})})}function gS(){const e=fe(Sn),[t,n]=g.useState(!1);return e?s.jsxs(s.Fragment,{children:[s.jsxs("button",{type:"button",className:Ie.generateBtn,onClick:()=>n(!0),children:[s.jsx("span",{"aria-hidden":"true",className:Ie.plus,children:"+"})," сгенерировать инструкцию"]}),t&&s.jsx(yS,{onClose:()=>n(!1)})]}):null}const vS="_wrapper_14d89_1",_S="_stopButton_14d89_7",wS="_startButton_14d89_8",xS="_statusEnabled_14d89_60",SS="_statusDisabled_14d89_61",kS="_error_14d89_78",Nn={wrapper:vS,stopButton:_S,startButton:wS,statusEnabled:xS,statusDisabled:SS,error:kS},ES="boykovgroup_admin_token";function _c(){const e=localStorage.getItem(ES);return e?{Authorization:`Bearer ${e}`}:{}}function jS(){const e=fe(Sn),[t,n]=g.useState(null),[r,o]=g.useState(!1),[l,i]=g.useState("");g.useEffect(()=>{if(!e)return;let u=!1;async function c(){try{const d=await fetch("/api/instructions/auto-generation",{headers:{..._c()}}),f=await d.json().catch(()=>({}));if(!d.ok)throw new Error((f==null?void 0:f.error)||"Не удалось получить состояние автогенерации");u||(n(f.enabled===!0),i(""))}catch(d){u||i(d.message)}}return c(),()=>{u=!0}},[e]);async function a(){if(!(r||t===null)){o(!0),i("");try{const u=await fetch("/api/instructions/auto-generation",{method:"PATCH",headers:{"Content-Type":"application/json",..._c()},body:JSON.stringify({enabled:!t})}),c=await u.json().catch(()=>({}));if(!u.ok)throw new Error((c==null?void 0:c.error)||"Не удалось изменить состояние автогенерации");n(c.enabled===!0)}catch(u){i(u.message)}finally{o(!1)}}}return e?s.jsxs("div",{className:Nn.wrapper,children:[s.jsxs("button",{type:"button",className:t?Nn.stopButton:Nn.startButton,disabled:r||t===null,onClick:a,children:[s.jsx("span",{className:t?Nn.statusEnabled:Nn.statusDisabled,"aria-hidden":"true"}),t===null?"проверка автогенерации":t?"остановить автогенерацию":"запустить автогенерацию"]}),l&&s.jsx("div",{className:Nn.error,children:l})]}):null}const CS="_panel_46uug_1",NS="_actions_46uug_9",RS="_importBlock_46uug_17",PS="_statsBlock_46uug_56",LS="_statsHeader_46uug_63",IS="_statsEyebrow_46uug_71",$S="_statsTitle_46uug_80",TS="_tracking_46uug_85",bS="_cards_46uug_90",MS="_card_46uug_90",OS="_cardLabel_46uug_105",zS="_cardValue_46uug_110",AS="_cardMeta_46uug_115",BS="_tableWrap_46uug_120",FS="_tableTitle_46uug_125",DS="_table_46uug_120",US="_statsError_46uug_150",HS="_publicationInbox_46uug_186",VS="_publicationInboxHeader_46uug_193",WS="_publicationInboxEyebrow_46uug_201",QS="_publicationInboxTitle_46uug_210",qS="_publicationInboxDescription_46uug_215",KS="_publicationInboxCount_46uug_223",GS="_publicationList_46uug_236",YS="_publicationCard_46uug_242",XS="_publicationCardMain_46uug_251",JS="_publicationMeta_46uug_255",ZS="_publicationProfession_46uug_261",ek="_publicationOrderId_46uug_267",tk="_publicationActions_46uug_277",nk="_publicationSecondaryButton_46uug_283",rk="_publicationApproveButton_46uug_284",ok="_publicationRejectButton_46uug_285",lk="_publicationEmpty_46uug_312",ik="_publicationModalOverlay_46uug_319",sk="_publicationModal_46uug_319",ak="_publicationModalHeader_46uug_340",uk="_publicationModalClose_46uug_350",ck="_publicationModalContent_46uug_361",dk="_publicationBadge_46uug_399",fk="_publicationBadgeLabel_46uug_412",pk="_publicationBadgeCount_46uug_416",b={panel:CS,actions:NS,importBlock:RS,statsBlock:PS,statsHeader:LS,statsEyebrow:IS,statsTitle:$S,tracking:TS,cards:bS,card:MS,cardLabel:OS,cardValue:zS,cardMeta:AS,tableWrap:BS,tableTitle:FS,table:DS,statsError:US,publicationInbox:HS,publicationInboxHeader:VS,publicationInboxEyebrow:WS,publicationInboxTitle:QS,publicationInboxDescription:qS,publicationInboxCount:KS,publicationList:GS,publicationCard:YS,publicationCardMain:XS,publicationMeta:JS,publicationProfession:ZS,publicationOrderId:ek,publicationActions:tk,publicationSecondaryButton:nk,publicationApproveButton:rk,publicationRejectButton:ok,publicationEmpty:lk,publicationModalOverlay:ik,publicationModal:sk,publicationModalHeader:ak,publicationModalClose:uk,publicationModalContent:ck,publicationBadge:dk,publicationBadgeLabel:fk,publicationBadgeCount:pk},mk=new Intl.NumberFormat("ru-RU"),hk=new Intl.NumberFormat("ru-RU",{minimumFractionDigits:2,maximumFractionDigits:2});function on(e){return mk.format(Number(e)||0)}function vr(e){return hk.format(Number(e)||0)+" ₽"}function yk(e){switch(e){case"schedule":return"По расписанию";case"repair":return"Восстановление";case"import":return"Импорт";case"generation":default:return"Генерация"}}function gk(e){const t=String(e||"").trim();if(!t)return"—";const n=t.match(/["']profession["']\s*:\s*["']([^"']+)["']/i);return n!=null&&n[1]?n[1].trim():t.includes("Ты являешься редактором")||t.includes("Текущий документ:")||t.includes("Верни только JSON")?"Восстановление инструкции":t.length>100?`${t.slice(0,97)}...`:t}function vk({importId:e,onImportCreated:t,onRefresh:n}){var k,E,N,C,z,I,A,Z,ae;const r=fe(Sn),o=fe(lr),[l,i]=g.useState([]),[a,u]=g.useState(!1),[c,d]=g.useState(""),[f,h]=g.useState(null),[_,w]=g.useState(null),[v,S]=g.useState(null),[p,m]=g.useState(null);g.useEffect(()=>{if(!r||!o){S(null);return}let M=!1;async function W(){try{const ze=await $w(o);M||(S(ze),m(null))}catch(ze){M||m(ze.message)}}W();const ue=setInterval(W,15e3);return()=>{M=!0,clearInterval(ue)}},[r,o]);async function y(M=!1){if(!r||!o){i([]);return}M||u(!0);try{const W=await fetch("/api/public-generation/admin/inbox",{headers:{Authorization:`Bearer ${o}`},cache:"no-store"}),ue=await W.json().catch(()=>({}));if(!W.ok)throw new Error((ue==null?void 0:ue.error)||"Не удалось загрузить ящик публикаций.");i(Array.isArray(ue==null?void 0:ue.items)?ue.items:[]),d("")}catch(W){d((W==null?void 0:W.message)||"Не удалось загрузить ящик публикаций.")}finally{M||u(!1)}}g.useEffect(()=>{if(!r||!o){i([]);return}y();const M=setInterval(()=>{y(!0)},15e3);return()=>{clearInterval(M)}},[r,o]);async function x(M,W){if(!o||!M)return;const ue=W==="approve";if(window.confirm(ue?"Опубликовать эту инструкцию в общем каталоге?":"Отклонить публикацию этой инструкции?")){h(M),d("");try{const R=await fetch(`/api/public-generation/admin/orders/${encodeURIComponent(M)}/${W}`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${o}`},body:JSON.stringify({})}),O=await R.json().catch(()=>({}));if(!R.ok)throw new Error((O==null?void 0:O.error)||"Не удалось изменить статус публикации.");i(T=>T.filter($=>$.id!==M)),(_==null?void 0:_.orderId)===M&&w(null)}catch(R){d((R==null?void 0:R.message)||"Не удалось изменить статус публикации.")}finally{h(null)}}}return s.jsxs("section",{className:b.panel,children:[s.jsxs("div",{className:b.actions,children:[s.jsx(tS,{onImportCreated:t}),s.jsx(gS,{}),s.jsx(jS,{}),r&&s.jsxs("div",{className:b.publicationBadge,title:"Инструкции, ожидающие решения о публикации",children:[s.jsx("span",{className:b.publicationBadgeLabel,children:"На публикацию"}),s.jsx("strong",{className:b.publicationBadgeCount,children:l.length})]})]}),r&&s.jsxs("div",{className:b.publicationInbox,children:[s.jsxs("div",{className:b.publicationInboxHeader,children:[s.jsxs("div",{children:[s.jsx("div",{className:b.publicationInboxEyebrow,children:"Публикации"}),s.jsx("h2",{className:b.publicationInboxTitle,children:"Ящик инструкций"}),s.jsx("p",{className:b.publicationInboxDescription,children:"Оплаченные инструкции уже выданы пользователям. Здесь вы решаете только, публиковать ли их в общем каталоге."})]}),s.jsx("div",{className:b.publicationInboxCount,children:l.length})]}),c&&s.jsx("div",{className:b.statsError,children:c}),a&&l.length===0?s.jsx("div",{className:b.publicationEmpty,children:"Загружаем новые инструкции..."}):l.length===0?s.jsx("div",{className:b.publicationEmpty,children:"Новых инструкций на публикацию нет."}):s.jsx("div",{className:b.publicationList,children:l.map(M=>s.jsxs("div",{className:b.publicationCard,children:[s.jsxs("div",{className:b.publicationCardMain,children:[s.jsx("div",{className:b.publicationMeta,children:M.generatedAt?new Date(M.generatedAt).toLocaleString("ru-RU"):"Дата не указана"}),s.jsx("h3",{className:b.publicationProfession,children:M.profession}),s.jsx("div",{className:b.publicationOrderId,children:M.id})]}),s.jsxs("div",{className:b.publicationActions,children:[s.jsx("button",{type:"button",className:b.publicationSecondaryButton,onClick:()=>{w({orderId:M.id,instruction:M.instruction})},children:"Просмотреть"}),s.jsx("button",{type:"button",className:b.publicationSecondaryButton,onClick:()=>{w({orderId:M.id,instruction:M.instruction,edit:!0})},children:"Редактировать"}),s.jsx("button",{type:"button",className:b.publicationApproveButton,disabled:f===M.id,onClick:()=>x(M.id,"approve"),children:"Опубликовать"}),s.jsx("button",{type:"button",className:b.publicationRejectButton,disabled:f===M.id,onClick:()=>x(M.id,"reject"),children:"Отклонить"})]})]},M.id))}),_&&s.jsx("div",{className:b.publicationModalOverlay,onMouseDown:M=>{M.target===M.currentTarget&&w(null)},children:s.jsxs("div",{className:b.publicationModal,children:[s.jsxs("div",{className:b.publicationModalHeader,children:[s.jsx("strong",{children:_.edit?"Редактирование инструкции":"Просмотр инструкции"}),s.jsx("button",{type:"button",className:b.publicationModalClose,onClick:()=>w(null),"aria-label":"Закрыть",children:"×"})]}),s.jsx("div",{className:b.publicationModalContent,children:_.edit?s.jsx(vp,{instruction:_.instruction,onClose:()=>w(null),onSave:async M=>{const W=await fetch(`/api/public-generation/admin/orders/${encodeURIComponent(_.orderId)}/instruction`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${o}`},body:JSON.stringify({instruction:M})}),ue=await W.json().catch(()=>({}));if(!W.ok){const R=ue&&ue.error?ue.error:"Не удалось сохранить изменения.";window.alert(R);throw new Error(R)}i(R=>R.map(O=>O.id===_.orderId?{...O,instruction:ue.instruction||M}:O)),w(null)}}):s.jsx(Np,{compact:!0,instruction:_.instruction})})]})})]}),r&&s.jsxs("div",{className:b.statsBlock,children:[s.jsxs("div",{className:b.statsHeader,children:[s.jsxs("div",{children:[s.jsx("div",{className:b.statsEyebrow,children:"YandexGPT"}),s.jsx("h2",{className:b.statsTitle,children:"Расходы на генерацию"})]}),(v==null?void 0:v.trackingStarted)&&s.jsxs("div",{className:b.tracking,children:["учёт с"," ",new Date(v.trackingStarted).toLocaleString("ru-RU")]})]}),p&&s.jsx("div",{className:b.statsError,children:p}),v&&s.jsxs(s.Fragment,{children:[s.jsxs("div",{className:b.cards,children:[s.jsxs("div",{className:b.card,children:[s.jsx("span",{className:b.cardLabel,children:"Сегодня"}),s.jsx("strong",{className:b.cardValue,children:on((k=v.today)==null?void 0:k.generations)}),s.jsxs("span",{className:b.cardMeta,children:["генераций ·"," ",vr((E=v.today)==null?void 0:E.costRub)]})]}),s.jsxs("div",{className:b.card,children:[s.jsx("span",{className:b.cardLabel,children:"За месяц"}),s.jsx("strong",{className:b.cardValue,children:vr((N=v.month)==null?void 0:N.costRub)}),s.jsxs("span",{className:b.cardMeta,children:[on((C=v.month)==null?void 0:C.generations)," ","генераций"]})]}),s.jsxs("div",{className:b.card,children:[s.jsx("span",{className:b.cardLabel,children:"Всего"}),s.jsx("strong",{className:b.cardValue,children:vr((z=v.total)==null?void 0:z.costRub)}),s.jsxs("span",{className:b.cardMeta,children:[on((I=v.total)==null?void 0:I.apiCalls)," ","API-запросов"]})]}),s.jsxs("div",{className:b.card,children:[s.jsx("span",{className:b.cardLabel,children:"Средняя генерация"}),s.jsx("strong",{className:b.cardValue,children:vr((A=v.total)==null?void 0:A.averageCostRub)}),s.jsxs("span",{className:b.cardMeta,children:[on((Z=v.total)==null?void 0:Z.totalTokens)," ","токенов всего"]})]})]}),((ae=v.recent)==null?void 0:ae.length)>0&&s.jsxs("div",{className:b.tableWrap,children:[s.jsx("div",{className:b.tableTitle,children:"Последние операции"}),s.jsxs("table",{className:b.table,children:[s.jsx("thead",{children:s.jsxs("tr",{children:[s.jsx("th",{children:"Тип"}),s.jsx("th",{children:"Профессия"}),s.jsx("th",{children:"API"}),s.jsx("th",{children:"Вход"}),s.jsx("th",{children:"Выход"}),s.jsx("th",{children:"Стоимость"})]})}),s.jsx("tbody",{children:v.recent.slice(0,10).map(M=>s.jsxs("tr",{children:[s.jsx("td",{children:yk(M.source)}),s.jsx("td",{children:gk(M.profession)}),s.jsx("td",{children:on(M.apiCalls)}),s.jsx("td",{children:on(M.inputTokens)}),s.jsx("td",{children:on(M.outputTokens)}),s.jsx("td",{children:s.jsx("strong",{children:vr(M.costRub)})})]},M.id))})]})]})]})]}),e&&s.jsx("div",{className:b.importBlock,children:s.jsx(Rp,{importId:e,onComplete:()=>{t(null)},onRefresh:n})})]})}function _k(){const e=so(),t=kt(),n=fe(Sn),[r,o]=g.useState(null),[l,i]=g.useState(()=>new URLSearchParams(window.location.search).get("q")??""),[a,u]=g.useState(null),[c,d]=g.useState(!1),f=Nw(l,350),h=g.useRef(null),_=g.useRef(null),w=g.useRef(null),v=g.useRef(!1),S=g.useRef(!0),{items:p,total:m,page:y,totalPages:x,isSearching:k,isLoadingMore:E,searchError:N,loadMoreError:C,isGenerating:z,generateError:I,deletingId:A}=fe(T=>T.instructions);g.useEffect(()=>{e(Q1())},[e]),g.useLayoutEffect(()=>{window.scrollTo({top:0,left:0,behavior:"auto"}),document.documentElement.scrollTop=0,document.body.scrollTop=0},[t.pathname]),g.useEffect(()=>{v.current=!1,S.current=!0,e(fn({query:f,page:1,pageSize:dn,append:!1}))},[e,f]),g.useLayoutEffect(()=>{d(!1),t.pathname==="/"&&(v.current=!1,S.current=!0)},[t.pathname]),g.useEffect(()=>{if(t.pathname!=="/"){d(!1);return}const T=h.current;if(!T){d(!1);return}let $=null;const Q=()=>{$=null;const P=T.getBoundingClientRect().top;d(B=>B?!(P>=16):P<=-4)},Ae=()=>{$===null&&($=window.requestAnimationFrame(Q))};return Q(),window.addEventListener("scroll",Ae,{passive:!0}),window.addEventListener("resize",Ae),()=>{window.removeEventListener("scroll",Ae),window.removeEventListener("resize",Ae),$!==null&&window.cancelAnimationFrame($)}},[t.pathname]);const Z=y<x;g.useEffect(()=>{S.current=!0},[f]);const ae=g.useCallback(async()=>{if(S.current&&!(v.current||k||E||!Z)){S.current=!1,v.current=!0;try{await e(fn({query:f,page:y+1,pageSize:dn,append:!0}))}finally{v.current=!1}}},[e,f,y,Z,k,E]);g.useEffect(()=>{const T=w.current;if(!T||!Z||C)return;const $=new IntersectionObserver(([Q])=>{if(!Q.isIntersecting){S.current=!0;return}Q.isIntersecting&&ae()},{rootMargin:"120px 0px",threshold:.01});return $.observe(T),()=>{$.disconnect()}},[ae,Z,C]);async function M(){n&&await e(Dp(f))}async function W(T){const $=await fetch(`/api/instructions/${T.id}`);if(!$.ok)return;const Q=await $.json();u(Q)}function ue(T){n&&e(qw(T))}async function ze(T){const $=await fetch(`/api/instructions/${T.id}`,{method:"PUT",headers:{"Content-Type":"application/json",Authorization:`Bearer ${localStorage.getItem("boykovgroup_admin_token")}`},body:JSON.stringify(T)});$.ok&&(await $.json(),u(null),e(fn({query:f,page:1,pageSize:dn})))}const R=!k&&!N&&f.trim()&&p.length===0;function O(){e(fn({query:f,page:1,pageSize:dn}))}return s.jsxs(vg,{children:[s.jsx(kr,{path:"/",element:s.jsxs("div",{className:q.page,children:[s.jsx(Wa,{query:l,onQueryChange:i}),s.jsx(vk,{importId:r,onImportCreated:T=>{o(T)},onRefresh:O}),s.jsx("div",{className:[q.safeCompactHeader,c?q.safeCompactHeaderVisible:""].filter(Boolean).join(" "),"aria-hidden":!c,children:s.jsx("div",{className:q.safeCompactInner,children:s.jsxs("div",{className:q.stickyIntroCompact,children:[s.jsxs("div",{className:q.compactControls,children:[s.jsx("div",{className:q.compactSearch,children:s.jsx(hl,{value:l,onChange:i})}),s.jsx("div",{className:q.compactLogo,children:s.jsx(yl,{})})]}),s.jsx(Xr,{}),s.jsxs("section",{className:q.hero,children:[s.jsxs("div",{className:q.heroText,children:[s.jsx("h1",{className:q.title,children:"Инструкции по охране труда"}),s.jsx("p",{className:q.subtitle,children:"Найдите готовую инструкцию для нужной профессии. База пополняется автоматически каждый день."})]}),s.jsx("div",{className:q.heroPortraitWrap,children:s.jsx(gl,{compact:!0})})]})]})})}),s.jsx("div",{ref:_,className:q.stickyTrigger,"aria-hidden":"true"}),s.jsxs("div",{ref:h,className:q.stickyIntro,children:[s.jsxs("div",{className:q.compactControls,children:[s.jsx("div",{className:q.compactSearch,children:s.jsx(hl,{value:l,onChange:i})}),s.jsx("div",{className:q.compactLogo,children:s.jsx(yl,{})})]}),s.jsx(Xr,{}),s.jsxs("section",{className:q.hero,children:[s.jsxs("div",{className:q.heroText,children:[s.jsx("h1",{className:q.title,children:"Инструкции по охране труда"}),s.jsx("p",{className:q.subtitle,children:"Найдите готовую инструкцию для нужной профессии. База пополняется автоматически каждый день."})]}),s.jsx("div",{className:q.heroPortraitWrap,children:s.jsx(gl,{compact:!1})})]})]}),s.jsxs("main",{children:[k&&s.jsx(_w,{label:"Загрузка..."}),!k&&N&&s.jsxs("p",{className:q.error,children:["Ошибка: ",N]}),!k&&!N&&p.length>0&&s.jsxs(s.Fragment,{children:[s.jsx("div",{className:q.resultsHead,children:s.jsxs("span",{className:q.count,children:["Всего инструкций: ",m]})}),s.jsx(yw,{instructions:p,total:m,query:f,isAdmin:n,onDelete:ue,onEdit:W,deletingId:A}),s.jsxs("div",{ref:w,className:q.loadMoreZone,"aria-live":"polite",children:[E&&s.jsx("span",{className:q.loadMoreText,children:"[ загружаем ещё ]"}),!E&&C&&Z&&s.jsx("button",{type:"button",className:q.loadMoreRetry,onClick:ae,children:"[ повторить загрузку ]"}),!E&&!C&&!Z&&s.jsx("span",{className:q.loadMoreDone,children:"[ все инструкции загружены ]"})]})]}),R&&s.jsx(Cw,{query:f,isAdmin:n,isGenerating:z,error:I,onGenerate:M})]}),s.jsx(W0,{}),a&&s.jsx(vp,{instruction:a,onClose:()=>u(null),onSave:ze})]})}),s.jsx(kr,{path:"/instrukcii-po-ohrane-truda",element:s.jsx(J0,{})}),s.jsx(kr,{path:"/srochnaya-generaciya-instrukcii",element:s.jsx(A0,{})}),s.jsx(kr,{path:"/instrukciya-po-ohrane-truda/:id",element:s.jsx(f_,{})})]})}function Jr(e){"@babel/helpers - typeof";return Jr=typeof Symbol=="function"&&typeof Symbol.iterator=="symbol"?function(t){return typeof t}:function(t){return t&&typeof Symbol=="function"&&t.constructor===Symbol&&t!==Symbol.prototype?"symbol":typeof t},Jr(e)}function wk(e,t){if(Jr(e)!="object"||!e)return e;var n=e[Symbol.toPrimitive];if(n!==void 0){var r=n.call(e,t);if(Jr(r)!="object")return r;throw new TypeError("@@toPrimitive must return a primitive value.")}return(t==="string"?String:Number)(e)}function xk(e){var t=wk(e,"string");return Jr(t)=="symbol"?t:t+""}function Sk(e,t,n){return(t=xk(t))in e?Object.defineProperty(e,t,{value:n,enumerable:!0,configurable:!0,writable:!0}):e[t]=n,e}function wc(e,t){var n=Object.keys(e);if(Object.getOwnPropertySymbols){var r=Object.getOwnPropertySymbols(e);t&&(r=r.filter(function(o){return Object.getOwnPropertyDescriptor(e,o).enumerable})),n.push.apply(n,r)}return n}function xc(e){for(var t=1;t<arguments.length;t++){var n=arguments[t]!=null?arguments[t]:{};t%2?wc(Object(n),!0).forEach(function(r){Sk(e,r,n[r])}):Object.getOwnPropertyDescriptors?Object.defineProperties(e,Object.getOwnPropertyDescriptors(n)):wc(Object(n)).forEach(function(r){Object.defineProperty(e,r,Object.getOwnPropertyDescriptor(n,r))})}return e}function Ee(e){return"Minified Redux error #"+e+"; visit https://redux.js.org/Errors?code="+e+" for the full message or use the non-minified dev environment for full errors. "}var Sc=function(){return typeof Symbol=="function"&&Symbol.observable||"@@observable"}(),Ai=function(){return Math.random().toString(36).substring(7).split("").join(".")},wl={INIT:"@@redux/INIT"+Ai(),REPLACE:"@@redux/REPLACE"+Ai(),PROBE_UNKNOWN_ACTION:function(){return"@@redux/PROBE_UNKNOWN_ACTION"+Ai()}};function kk(e){if(typeof e!="object"||e===null)return!1;for(var t=e;Object.getPrototypeOf(t)!==null;)t=Object.getPrototypeOf(t);return Object.getPrototypeOf(e)===t}function Up(e,t,n){var r;if(typeof t=="function"&&typeof n=="function"||typeof n=="function"&&typeof arguments[3]=="function")throw new Error(Ee(0));if(typeof t=="function"&&typeof n>"u"&&(n=t,t=void 0),typeof n<"u"){if(typeof n!="function")throw new Error(Ee(1));return n(Up)(e,t)}if(typeof e!="function")throw new Error(Ee(2));var o=e,l=t,i=[],a=i,u=!1;function c(){a===i&&(a=i.slice())}function d(){if(u)throw new Error(Ee(3));return l}function f(v){if(typeof v!="function")throw new Error(Ee(4));if(u)throw new Error(Ee(5));var S=!0;return c(),a.push(v),function(){if(S){if(u)throw new Error(Ee(6));S=!1,c();var m=a.indexOf(v);a.splice(m,1),i=null}}}function h(v){if(!kk(v))throw new Error(Ee(7));if(typeof v.type>"u")throw new Error(Ee(8));if(u)throw new Error(Ee(9));try{u=!0,l=o(l,v)}finally{u=!1}for(var S=i=a,p=0;p<S.length;p++){var m=S[p];m()}return v}function _(v){if(typeof v!="function")throw new Error(Ee(10));o=v,h({type:wl.REPLACE})}function w(){var v,S=f;return v={subscribe:function(m){if(typeof m!="object"||m===null)throw new Error(Ee(11));function y(){m.next&&m.next(d())}y();var x=S(y);return{unsubscribe:x}}},v[Sc]=function(){return this},v}return h({type:wl.INIT}),r={dispatch:h,subscribe:f,getState:d,replaceReducer:_},r[Sc]=w,r}function Ek(e){Object.keys(e).forEach(function(t){var n=e[t],r=n(void 0,{type:wl.INIT});if(typeof r>"u")throw new Error(Ee(12));if(typeof n(void 0,{type:wl.PROBE_UNKNOWN_ACTION()})>"u")throw new Error(Ee(13))})}function jk(e){for(var t=Object.keys(e),n={},r=0;r<t.length;r++){var o=t[r];typeof e[o]=="function"&&(n[o]=e[o])}var l=Object.keys(n),i;try{Ek(n)}catch(a){i=a}return function(u,c){if(u===void 0&&(u={}),i)throw i;for(var d=!1,f={},h=0;h<l.length;h++){var _=l[h],w=n[_],v=u[_],S=w(v,c);if(typeof S>"u")throw c&&c.type,new Error(Ee(14));f[_]=S,d=d||S!==v}return d=d||l.length!==Object.keys(u).length,d?f:u}}function Ck(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return t.length===0?function(r){return r}:t.length===1?t[0]:t.reduce(function(r,o){return function(){return r(o.apply(void 0,arguments))}})}function Nk(){for(var e=arguments.length,t=new Array(e),n=0;n<e;n++)t[n]=arguments[n];return function(r){return function(){var o=r.apply(void 0,arguments),l=function(){throw new Error(Ee(15))},i={getState:o.getState,dispatch:function(){return l.apply(void 0,arguments)}},a=t.map(function(u){return u(i)});return l=Ck.apply(void 0,a)(o.dispatch),xc(xc({},o),{},{dispatch:l})}}}function Hp(e){var t=function(r){var o=r.dispatch,l=r.getState;return function(i){return function(a){return typeof a=="function"?a(o,l,e):i(a)}}};return t}var Vp=Hp();Vp.withExtraArgument=Hp;const Rk=jk({auth:U1,instructions:Ww}),Pk=Up(Rk,Nk(Vp));Bi.createRoot(document.getElementById("root")).render(s.jsx(am.StrictMode,{children:s.jsx(Bv,{store:Pk,children:s.jsx(Ug,{children:s.jsx(_k,{})})})}));
