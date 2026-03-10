const ec=()=>{};var Hi={};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ta={NODE_ADMIN:!1,SDK_VERSION:"${JSCORE_VERSION}"};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const nc=function(n,t){if(!n)throw rc(t)},rc=function(n){return new Error("Firebase Database ("+ta.SDK_VERSION+") INTERNAL ASSERT FAILED: "+n)};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ea=function(n){const t=[];let e=0;for(let r=0;r<n.length;r++){let i=n.charCodeAt(r);i<128?t[e++]=i:i<2048?(t[e++]=i>>6|192,t[e++]=i&63|128):(i&64512)===55296&&r+1<n.length&&(n.charCodeAt(r+1)&64512)===56320?(i=65536+((i&1023)<<10)+(n.charCodeAt(++r)&1023),t[e++]=i>>18|240,t[e++]=i>>12&63|128,t[e++]=i>>6&63|128,t[e++]=i&63|128):(t[e++]=i>>12|224,t[e++]=i>>6&63|128,t[e++]=i&63|128)}return t},sc=function(n){const t=[];let e=0,r=0;for(;e<n.length;){const i=n[e++];if(i<128)t[r++]=String.fromCharCode(i);else if(i>191&&i<224){const o=n[e++];t[r++]=String.fromCharCode((i&31)<<6|o&63)}else if(i>239&&i<365){const o=n[e++],u=n[e++],l=n[e++],f=((i&7)<<18|(o&63)<<12|(u&63)<<6|l&63)-65536;t[r++]=String.fromCharCode(55296+(f>>10)),t[r++]=String.fromCharCode(56320+(f&1023))}else{const o=n[e++],u=n[e++];t[r++]=String.fromCharCode((i&15)<<12|(o&63)<<6|u&63)}}return t.join("")},na={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,t){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const e=t?this.byteToCharMapWebSafe_:this.byteToCharMap_,r=[];for(let i=0;i<n.length;i+=3){const o=n[i],u=i+1<n.length,l=u?n[i+1]:0,f=i+2<n.length,d=f?n[i+2]:0,_=o>>2,v=(o&3)<<4|l>>4;let R=(l&15)<<2|d>>6,C=d&63;f||(C=64,u||(R=64)),r.push(e[_],e[v],e[R],e[C])}return r.join("")},encodeString(n,t){return this.HAS_NATIVE_SUPPORT&&!t?btoa(n):this.encodeByteArray(ea(n),t)},decodeString(n,t){return this.HAS_NATIVE_SUPPORT&&!t?atob(n):sc(this.decodeStringToByteArray(n,t))},decodeStringToByteArray(n,t){this.init_();const e=t?this.charToByteMapWebSafe_:this.charToByteMap_,r=[];for(let i=0;i<n.length;){const o=e[n.charAt(i++)],l=i<n.length?e[n.charAt(i)]:0;++i;const d=i<n.length?e[n.charAt(i)]:64;++i;const v=i<n.length?e[n.charAt(i)]:64;if(++i,o==null||l==null||d==null||v==null)throw new ic;const R=o<<2|l>>4;if(r.push(R),d!==64){const C=l<<4&240|d>>2;if(r.push(C),v!==64){const O=d<<6&192|v;r.push(O)}}}return r},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class ic extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const oc=function(n){const t=ea(n);return na.encodeByteArray(t,!0)},Gn=function(n){return oc(n).replace(/\./g,"")},Qr=function(n){try{return na.decodeString(n,!0)}catch(t){console.error("base64Decode failed: ",t)}return null};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Jd(n){return ra(void 0,n)}function ra(n,t){if(!(t instanceof Object))return t;switch(t.constructor){case Date:const e=t;return new Date(e.getTime());case Object:n===void 0&&(n={});break;case Array:n=[];break;default:return t}for(const e in t)!t.hasOwnProperty(e)||!ac(e)||(n[e]=ra(n[e],t[e]));return n}function ac(n){return n!=="__proto__"}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function uc(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cc=()=>uc().__FIREBASE_DEFAULTS__,lc=()=>{if(typeof process>"u"||typeof Hi>"u")return;const n=Hi.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},hc=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const t=n&&Qr(n[1]);return t&&JSON.parse(t)},Ts=()=>{try{return ec()||cc()||lc()||hc()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},fc=n=>{var t,e;return(e=(t=Ts())==null?void 0:t.emulatorHosts)==null?void 0:e[n]},dc=n=>{const t=fc(n);if(!t)return;const e=t.lastIndexOf(":");if(e<=0||e+1===t.length)throw new Error(`Invalid host ${t} with no separate hostname and port!`);const r=parseInt(t.substring(e+1),10);return t[0]==="["?[t.substring(1,e-1),r]:[t.substring(0,e),r]},sa=()=>{var n;return(n=Ts())==null?void 0:n.config};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mc{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((t,e)=>{this.resolve=t,this.reject=e})}wrapCallback(t){return(e,r)=>{e?this.reject(e):this.resolve(r),typeof t=="function"&&(this.promise.catch(()=>{}),t.length===1?t(e):t(e,r))}}}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function vs(n){try{return(n.startsWith("http://")||n.startsWith("https://")?new URL(n).hostname:n).endsWith(".cloudworkstations.dev")}catch{return!1}}async function pc(n){return(await fetch(n,{credentials:"include"})).ok}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function gc(n,t){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const e={alg:"none",type:"JWT"},r=t||"demo-project",i=n.iat||0,o=n.sub||n.user_id;if(!o)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const u={iss:`https://securetoken.google.com/${r}`,aud:r,iat:i,exp:i+3600,auth_time:i,sub:o,user_id:o,firebase:{sign_in_provider:"custom",identities:{}},...n};return[Gn(JSON.stringify(e)),Gn(JSON.stringify(u)),""].join(".")}const nn={};function _c(){const n={prod:[],emulator:[]};for(const t of Object.keys(nn))nn[t]?n.emulator.push(t):n.prod.push(t);return n}function yc(n){let t=document.getElementById(n),e=!1;return t||(t=document.createElement("div"),t.setAttribute("id",n),e=!0),{created:e,element:t}}let Gi=!1;function Ec(n,t){if(typeof window>"u"||typeof document>"u"||!vs(window.location.host)||nn[n]===t||nn[n]||Gi)return;nn[n]=t;function e(R){return`__firebase__banner__${R}`}const r="__firebase__banner",o=_c().prod.length>0;function u(){const R=document.getElementById(r);R&&R.remove()}function l(R){R.style.display="flex",R.style.background="#7faaf0",R.style.position="fixed",R.style.bottom="5px",R.style.left="5px",R.style.padding=".5em",R.style.borderRadius="5px",R.style.alignItems="center"}function f(R,C){R.setAttribute("width","24"),R.setAttribute("id",C),R.setAttribute("height","24"),R.setAttribute("viewBox","0 0 24 24"),R.setAttribute("fill","none"),R.style.marginLeft="-6px"}function d(){const R=document.createElement("span");return R.style.cursor="pointer",R.style.marginLeft="16px",R.style.fontSize="24px",R.innerHTML=" &times;",R.onclick=()=>{Gi=!0,u()},R}function _(R,C){R.setAttribute("id",C),R.innerText="Learn more",R.href="https://firebase.google.com/docs/studio/preview-apps#preview-backend",R.setAttribute("target","__blank"),R.style.paddingLeft="5px",R.style.textDecoration="underline"}function v(){const R=yc(r),C=e("text"),O=document.getElementById(C)||document.createElement("span"),L=e("learnmore"),N=document.getElementById(L)||document.createElement("a"),W=e("preprendIcon"),H=document.getElementById(W)||document.createElementNS("http://www.w3.org/2000/svg","svg");if(R.created){const J=R.element;l(J),_(N,L);const Et=d();f(H,W),J.append(H,O,N,Et),document.body.appendChild(J)}o?(O.innerText="Preview backend disconnected.",H.innerHTML=`<g clip-path="url(#clip0_6013_33858)">
<path d="M4.8 17.6L12 5.6L19.2 17.6H4.8ZM6.91667 16.4H17.0833L12 7.93333L6.91667 16.4ZM12 15.6C12.1667 15.6 12.3056 15.5444 12.4167 15.4333C12.5389 15.3111 12.6 15.1667 12.6 15C12.6 14.8333 12.5389 14.6944 12.4167 14.5833C12.3056 14.4611 12.1667 14.4 12 14.4C11.8333 14.4 11.6889 14.4611 11.5667 14.5833C11.4556 14.6944 11.4 14.8333 11.4 15C11.4 15.1667 11.4556 15.3111 11.5667 15.4333C11.6889 15.5444 11.8333 15.6 12 15.6ZM11.4 13.6H12.6V10.4H11.4V13.6Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6013_33858">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`):(H.innerHTML=`<g clip-path="url(#clip0_6083_34804)">
<path d="M11.4 15.2H12.6V11.2H11.4V15.2ZM12 10C12.1667 10 12.3056 9.94444 12.4167 9.83333C12.5389 9.71111 12.6 9.56667 12.6 9.4C12.6 9.23333 12.5389 9.09444 12.4167 8.98333C12.3056 8.86111 12.1667 8.8 12 8.8C11.8333 8.8 11.6889 8.86111 11.5667 8.98333C11.4556 9.09444 11.4 9.23333 11.4 9.4C11.4 9.56667 11.4556 9.71111 11.5667 9.83333C11.6889 9.94444 11.8333 10 12 10ZM12 18.4C11.1222 18.4 10.2944 18.2333 9.51667 17.9C8.73889 17.5667 8.05556 17.1111 7.46667 16.5333C6.88889 15.9444 6.43333 15.2611 6.1 14.4833C5.76667 13.7056 5.6 12.8778 5.6 12C5.6 11.1111 5.76667 10.2833 6.1 9.51667C6.43333 8.73889 6.88889 8.06111 7.46667 7.48333C8.05556 6.89444 8.73889 6.43333 9.51667 6.1C10.2944 5.76667 11.1222 5.6 12 5.6C12.8889 5.6 13.7167 5.76667 14.4833 6.1C15.2611 6.43333 15.9389 6.89444 16.5167 7.48333C17.1056 8.06111 17.5667 8.73889 17.9 9.51667C18.2333 10.2833 18.4 11.1111 18.4 12C18.4 12.8778 18.2333 13.7056 17.9 14.4833C17.5667 15.2611 17.1056 15.9444 16.5167 16.5333C15.9389 17.1111 15.2611 17.5667 14.4833 17.9C13.7167 18.2333 12.8889 18.4 12 18.4ZM12 17.2C13.4444 17.2 14.6722 16.6944 15.6833 15.6833C16.6944 14.6722 17.2 13.4444 17.2 12C17.2 10.5556 16.6944 9.32778 15.6833 8.31667C14.6722 7.30555 13.4444 6.8 12 6.8C10.5556 6.8 9.32778 7.30555 8.31667 8.31667C7.30556 9.32778 6.8 10.5556 6.8 12C6.8 13.4444 7.30556 14.6722 8.31667 15.6833C9.32778 16.6944 10.5556 17.2 12 17.2Z" fill="#212121"/>
</g>
<defs>
<clipPath id="clip0_6083_34804">
<rect width="24" height="24" fill="white"/>
</clipPath>
</defs>`,O.innerText="Preview backend running in this workspace."),O.setAttribute("id",C)}document.readyState==="loading"?window.addEventListener("DOMContentLoaded",v):v()}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ia(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function Yd(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(ia())}function Tc(){var t;const n=(t=Ts())==null?void 0:t.forceEnvironment;if(n==="node")return!0;if(n==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function Xd(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function Zd(){return ta.NODE_ADMIN===!0}function vc(){return!Tc()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function Ic(){try{return typeof indexedDB=="object"}catch{return!1}}function wc(){return new Promise((n,t)=>{try{let e=!0;const r="validate-browser-context-for-indexeddb-analytics-module",i=self.indexedDB.open(r);i.onsuccess=()=>{i.result.close(),e||self.indexedDB.deleteDatabase(r),n(!0)},i.onupgradeneeded=()=>{e=!1},i.onerror=()=>{var o;t(((o=i.error)==null?void 0:o.message)||"")}}catch(e){t(e)}})}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ac="FirebaseError";class Ne extends Error{constructor(t,e,r){super(e),this.code=t,this.customData=r,this.name=Ac,Object.setPrototypeOf(this,Ne.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,oa.prototype.create)}}class oa{constructor(t,e,r){this.service=t,this.serviceName=e,this.errors=r}create(t,...e){const r=e[0]||{},i=`${this.service}/${t}`,o=this.errors[t],u=o?Rc(o,r):"Error",l=`${this.serviceName}: ${u} (${i}).`;return new Ne(i,l,r)}}function Rc(n,t){return n.replace(Sc,(e,r)=>{const i=t[r];return i!=null?String(i):`<${r}?>`})}const Sc=/\{\$([^}]+)}/g;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ki(n){return JSON.parse(n)}function tm(n){return JSON.stringify(n)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const aa=function(n){let t={},e={},r={},i="";try{const o=n.split(".");t=Ki(Qr(o[0])||""),e=Ki(Qr(o[1])||""),i=o[2],r=e.d||{},delete e.d}catch{}return{header:t,claims:e,data:r,signature:i}},em=function(n){const t=aa(n),e=t.claims;return!!e&&typeof e=="object"&&e.hasOwnProperty("iat")},nm=function(n){const t=aa(n).claims;return typeof t=="object"&&t.admin===!0};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function rm(n,t){return Object.prototype.hasOwnProperty.call(n,t)}function sm(n,t){if(Object.prototype.hasOwnProperty.call(n,t))return n[t]}function im(n){for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t))return!1;return!0}function om(n,t,e){const r={};for(const i in n)Object.prototype.hasOwnProperty.call(n,i)&&(r[i]=t.call(e,n[i],i,n));return r}function Kn(n,t){if(n===t)return!0;const e=Object.keys(n),r=Object.keys(t);for(const i of e){if(!r.includes(i))return!1;const o=n[i],u=t[i];if(Qi(o)&&Qi(u)){if(!Kn(o,u))return!1}else if(o!==u)return!1}for(const i of r)if(!e.includes(i))return!1;return!0}function Qi(n){return n!==null&&typeof n=="object"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function am(n){const t=[];for(const[e,r]of Object.entries(n))Array.isArray(r)?r.forEach(i=>{t.push(encodeURIComponent(e)+"="+encodeURIComponent(i))}):t.push(encodeURIComponent(e)+"="+encodeURIComponent(r));return t.length?"&"+t.join("&"):""}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class um{constructor(){this.chain_=[],this.buf_=[],this.W_=[],this.pad_=[],this.inbuf_=0,this.total_=0,this.blockSize=512/8,this.pad_[0]=128;for(let t=1;t<this.blockSize;++t)this.pad_[t]=0;this.reset()}reset(){this.chain_[0]=1732584193,this.chain_[1]=4023233417,this.chain_[2]=2562383102,this.chain_[3]=271733878,this.chain_[4]=3285377520,this.inbuf_=0,this.total_=0}compress_(t,e){e||(e=0);const r=this.W_;if(typeof t=="string")for(let v=0;v<16;v++)r[v]=t.charCodeAt(e)<<24|t.charCodeAt(e+1)<<16|t.charCodeAt(e+2)<<8|t.charCodeAt(e+3),e+=4;else for(let v=0;v<16;v++)r[v]=t[e]<<24|t[e+1]<<16|t[e+2]<<8|t[e+3],e+=4;for(let v=16;v<80;v++){const R=r[v-3]^r[v-8]^r[v-14]^r[v-16];r[v]=(R<<1|R>>>31)&4294967295}let i=this.chain_[0],o=this.chain_[1],u=this.chain_[2],l=this.chain_[3],f=this.chain_[4],d,_;for(let v=0;v<80;v++){v<40?v<20?(d=l^o&(u^l),_=1518500249):(d=o^u^l,_=1859775393):v<60?(d=o&u|l&(o|u),_=2400959708):(d=o^u^l,_=3395469782);const R=(i<<5|i>>>27)+d+f+_+r[v]&4294967295;f=l,l=u,u=(o<<30|o>>>2)&4294967295,o=i,i=R}this.chain_[0]=this.chain_[0]+i&4294967295,this.chain_[1]=this.chain_[1]+o&4294967295,this.chain_[2]=this.chain_[2]+u&4294967295,this.chain_[3]=this.chain_[3]+l&4294967295,this.chain_[4]=this.chain_[4]+f&4294967295}update(t,e){if(t==null)return;e===void 0&&(e=t.length);const r=e-this.blockSize;let i=0;const o=this.buf_;let u=this.inbuf_;for(;i<e;){if(u===0)for(;i<=r;)this.compress_(t,i),i+=this.blockSize;if(typeof t=="string"){for(;i<e;)if(o[u]=t.charCodeAt(i),++u,++i,u===this.blockSize){this.compress_(o),u=0;break}}else for(;i<e;)if(o[u]=t[i],++u,++i,u===this.blockSize){this.compress_(o),u=0;break}}this.inbuf_=u,this.total_+=e}digest(){const t=[];let e=this.total_*8;this.inbuf_<56?this.update(this.pad_,56-this.inbuf_):this.update(this.pad_,this.blockSize-(this.inbuf_-56));for(let i=this.blockSize-1;i>=56;i--)this.buf_[i]=e&255,e/=256;this.compress_(this.buf_);let r=0;for(let i=0;i<5;i++)for(let o=24;o>=0;o-=8)t[r]=this.chain_[i]>>o&255,++r;return t}}function cm(n,t){return`${n} failed: ${t} argument `}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lm=function(n){const t=[];let e=0;for(let r=0;r<n.length;r++){let i=n.charCodeAt(r);if(i>=55296&&i<=56319){const o=i-55296;r++,nc(r<n.length,"Surrogate pair missing trail surrogate.");const u=n.charCodeAt(r)-56320;i=65536+(o<<10)+u}i<128?t[e++]=i:i<2048?(t[e++]=i>>6|192,t[e++]=i&63|128):i<65536?(t[e++]=i>>12|224,t[e++]=i>>6&63|128,t[e++]=i&63|128):(t[e++]=i>>18|240,t[e++]=i>>12&63|128,t[e++]=i>>6&63|128,t[e++]=i&63|128)}return t},hm=function(n){let t=0;for(let e=0;e<n.length;e++){const r=n.charCodeAt(e);r<128?t++:r<2048?t+=2:r>=55296&&r<=56319?(t+=4,e++):t+=3}return t};/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ua(n){return n&&n._delegate?n._delegate:n}class un{constructor(t,e,r){this.name=t,this.instanceFactory=e,this.type=r,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(t){return this.instantiationMode=t,this}setMultipleInstances(t){return this.multipleInstances=t,this}setServiceProps(t){return this.serviceProps=t,this}setInstanceCreatedCallback(t){return this.onInstanceCreated=t,this}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ie="[DEFAULT]";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Cc{constructor(t,e){this.name=t,this.container=e,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(t){const e=this.normalizeInstanceIdentifier(t);if(!this.instancesDeferred.has(e)){const r=new mc;if(this.instancesDeferred.set(e,r),this.isInitialized(e)||this.shouldAutoInitialize())try{const i=this.getOrInitializeService({instanceIdentifier:e});i&&r.resolve(i)}catch{}}return this.instancesDeferred.get(e).promise}getImmediate(t){const e=this.normalizeInstanceIdentifier(t==null?void 0:t.identifier),r=(t==null?void 0:t.optional)??!1;if(this.isInitialized(e)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:e})}catch(i){if(r)return null;throw i}else{if(r)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(t){if(t.name!==this.name)throw Error(`Mismatching Component ${t.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=t,!!this.shouldAutoInitialize()){if(Pc(t))try{this.getOrInitializeService({instanceIdentifier:ie})}catch{}for(const[e,r]of this.instancesDeferred.entries()){const i=this.normalizeInstanceIdentifier(e);try{const o=this.getOrInitializeService({instanceIdentifier:i});r.resolve(o)}catch{}}}}clearInstance(t=ie){this.instancesDeferred.delete(t),this.instancesOptions.delete(t),this.instances.delete(t)}async delete(){const t=Array.from(this.instances.values());await Promise.all([...t.filter(e=>"INTERNAL"in e).map(e=>e.INTERNAL.delete()),...t.filter(e=>"_delete"in e).map(e=>e._delete())])}isComponentSet(){return this.component!=null}isInitialized(t=ie){return this.instances.has(t)}getOptions(t=ie){return this.instancesOptions.get(t)||{}}initialize(t={}){const{options:e={}}=t,r=this.normalizeInstanceIdentifier(t.instanceIdentifier);if(this.isInitialized(r))throw Error(`${this.name}(${r}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const i=this.getOrInitializeService({instanceIdentifier:r,options:e});for(const[o,u]of this.instancesDeferred.entries()){const l=this.normalizeInstanceIdentifier(o);r===l&&u.resolve(i)}return i}onInit(t,e){const r=this.normalizeInstanceIdentifier(e),i=this.onInitCallbacks.get(r)??new Set;i.add(t),this.onInitCallbacks.set(r,i);const o=this.instances.get(r);return o&&t(o,r),()=>{i.delete(t)}}invokeOnInitCallbacks(t,e){const r=this.onInitCallbacks.get(e);if(r)for(const i of r)try{i(t,e)}catch{}}getOrInitializeService({instanceIdentifier:t,options:e={}}){let r=this.instances.get(t);if(!r&&this.component&&(r=this.component.instanceFactory(this.container,{instanceIdentifier:bc(t),options:e}),this.instances.set(t,r),this.instancesOptions.set(t,e),this.invokeOnInitCallbacks(r,t),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,t,r)}catch{}return r||null}normalizeInstanceIdentifier(t=ie){return this.component?this.component.multipleInstances?t:ie:t}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function bc(n){return n===ie?void 0:n}function Pc(n){return n.instantiationMode==="EAGER"}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vc{constructor(t){this.name=t,this.providers=new Map}addComponent(t){const e=this.getProvider(t.name);if(e.isComponentSet())throw new Error(`Component ${t.name} has already been registered with ${this.name}`);e.setComponent(t)}addOrOverwriteComponent(t){this.getProvider(t.name).isComponentSet()&&this.providers.delete(t.name),this.addComponent(t)}getProvider(t){if(this.providers.has(t))return this.providers.get(t);const e=new Cc(t,this);return this.providers.set(t,e),e}getProviders(){return Array.from(this.providers.values())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var j;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(j||(j={}));const Dc={debug:j.DEBUG,verbose:j.VERBOSE,info:j.INFO,warn:j.WARN,error:j.ERROR,silent:j.SILENT},Nc=j.INFO,kc={[j.DEBUG]:"log",[j.VERBOSE]:"log",[j.INFO]:"info",[j.WARN]:"warn",[j.ERROR]:"error"},Oc=(n,t,...e)=>{if(t<n.logLevel)return;const r=new Date().toISOString(),i=kc[t];if(i)console[i](`[${r}]  ${n.name}:`,...e);else throw new Error(`Attempted to log a message with an invalid logType (value: ${t})`)};class ca{constructor(t){this.name=t,this._logLevel=Nc,this._logHandler=Oc,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(t){if(!(t in j))throw new TypeError(`Invalid value "${t}" assigned to \`logLevel\``);this._logLevel=t}setLogLevel(t){this._logLevel=typeof t=="string"?Dc[t]:t}get logHandler(){return this._logHandler}set logHandler(t){if(typeof t!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=t}get userLogHandler(){return this._userLogHandler}set userLogHandler(t){this._userLogHandler=t}debug(...t){this._userLogHandler&&this._userLogHandler(this,j.DEBUG,...t),this._logHandler(this,j.DEBUG,...t)}log(...t){this._userLogHandler&&this._userLogHandler(this,j.VERBOSE,...t),this._logHandler(this,j.VERBOSE,...t)}info(...t){this._userLogHandler&&this._userLogHandler(this,j.INFO,...t),this._logHandler(this,j.INFO,...t)}warn(...t){this._userLogHandler&&this._userLogHandler(this,j.WARN,...t),this._logHandler(this,j.WARN,...t)}error(...t){this._userLogHandler&&this._userLogHandler(this,j.ERROR,...t),this._logHandler(this,j.ERROR,...t)}}const xc=(n,t)=>t.some(e=>n instanceof e);let Wi,Ji;function Mc(){return Wi||(Wi=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function Lc(){return Ji||(Ji=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const la=new WeakMap,Wr=new WeakMap,ha=new WeakMap,Fr=new WeakMap,Is=new WeakMap;function Fc(n){const t=new Promise((e,r)=>{const i=()=>{n.removeEventListener("success",o),n.removeEventListener("error",u)},o=()=>{e(qt(n.result)),i()},u=()=>{r(n.error),i()};n.addEventListener("success",o),n.addEventListener("error",u)});return t.then(e=>{e instanceof IDBCursor&&la.set(e,n)}).catch(()=>{}),Is.set(t,n),t}function Uc(n){if(Wr.has(n))return;const t=new Promise((e,r)=>{const i=()=>{n.removeEventListener("complete",o),n.removeEventListener("error",u),n.removeEventListener("abort",u)},o=()=>{e(),i()},u=()=>{r(n.error||new DOMException("AbortError","AbortError")),i()};n.addEventListener("complete",o),n.addEventListener("error",u),n.addEventListener("abort",u)});Wr.set(n,t)}let Jr={get(n,t,e){if(n instanceof IDBTransaction){if(t==="done")return Wr.get(n);if(t==="objectStoreNames")return n.objectStoreNames||ha.get(n);if(t==="store")return e.objectStoreNames[1]?void 0:e.objectStore(e.objectStoreNames[0])}return qt(n[t])},set(n,t,e){return n[t]=e,!0},has(n,t){return n instanceof IDBTransaction&&(t==="done"||t==="store")?!0:t in n}};function Bc(n){Jr=n(Jr)}function jc(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(t,...e){const r=n.call(Ur(this),t,...e);return ha.set(r,t.sort?t.sort():[t]),qt(r)}:Lc().includes(n)?function(...t){return n.apply(Ur(this),t),qt(la.get(this))}:function(...t){return qt(n.apply(Ur(this),t))}}function qc(n){return typeof n=="function"?jc(n):(n instanceof IDBTransaction&&Uc(n),xc(n,Mc())?new Proxy(n,Jr):n)}function qt(n){if(n instanceof IDBRequest)return Fc(n);if(Fr.has(n))return Fr.get(n);const t=qc(n);return t!==n&&(Fr.set(n,t),Is.set(t,n)),t}const Ur=n=>Is.get(n);function $c(n,t,{blocked:e,upgrade:r,blocking:i,terminated:o}={}){const u=indexedDB.open(n,t),l=qt(u);return r&&u.addEventListener("upgradeneeded",f=>{r(qt(u.result),f.oldVersion,f.newVersion,qt(u.transaction),f)}),e&&u.addEventListener("blocked",f=>e(f.oldVersion,f.newVersion,f)),l.then(f=>{o&&f.addEventListener("close",()=>o()),i&&f.addEventListener("versionchange",d=>i(d.oldVersion,d.newVersion,d))}).catch(()=>{}),l}const zc=["get","getKey","getAll","getAllKeys","count"],Hc=["put","add","delete","clear"],Br=new Map;function Yi(n,t){if(!(n instanceof IDBDatabase&&!(t in n)&&typeof t=="string"))return;if(Br.get(t))return Br.get(t);const e=t.replace(/FromIndex$/,""),r=t!==e,i=Hc.includes(e);if(!(e in(r?IDBIndex:IDBObjectStore).prototype)||!(i||zc.includes(e)))return;const o=async function(u,...l){const f=this.transaction(u,i?"readwrite":"readonly");let d=f.store;return r&&(d=d.index(l.shift())),(await Promise.all([d[e](...l),i&&f.done]))[0]};return Br.set(t,o),o}Bc(n=>({...n,get:(t,e,r)=>Yi(t,e)||n.get(t,e,r),has:(t,e)=>!!Yi(t,e)||n.has(t,e)}));/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gc{constructor(t){this.container=t}getPlatformInfoString(){return this.container.getProviders().map(e=>{if(Kc(e)){const r=e.getImmediate();return`${r.library}/${r.version}`}else return null}).filter(e=>e).join(" ")}}function Kc(n){const t=n.getComponent();return(t==null?void 0:t.type)==="VERSION"}const Yr="@firebase/app",Xi="0.14.9";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Nt=new ca("@firebase/app"),Qc="@firebase/app-compat",Wc="@firebase/analytics-compat",Jc="@firebase/analytics",Yc="@firebase/app-check-compat",Xc="@firebase/app-check",Zc="@firebase/auth",tl="@firebase/auth-compat",el="@firebase/database",nl="@firebase/data-connect",rl="@firebase/database-compat",sl="@firebase/functions",il="@firebase/functions-compat",ol="@firebase/installations",al="@firebase/installations-compat",ul="@firebase/messaging",cl="@firebase/messaging-compat",ll="@firebase/performance",hl="@firebase/performance-compat",fl="@firebase/remote-config",dl="@firebase/remote-config-compat",ml="@firebase/storage",pl="@firebase/storage-compat",gl="@firebase/firestore",_l="@firebase/ai",yl="@firebase/firestore-compat",El="firebase",Tl="12.10.0";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xr="[DEFAULT]",vl={[Yr]:"fire-core",[Qc]:"fire-core-compat",[Jc]:"fire-analytics",[Wc]:"fire-analytics-compat",[Xc]:"fire-app-check",[Yc]:"fire-app-check-compat",[Zc]:"fire-auth",[tl]:"fire-auth-compat",[el]:"fire-rtdb",[nl]:"fire-data-connect",[rl]:"fire-rtdb-compat",[sl]:"fire-fn",[il]:"fire-fn-compat",[ol]:"fire-iid",[al]:"fire-iid-compat",[ul]:"fire-fcm",[cl]:"fire-fcm-compat",[ll]:"fire-perf",[hl]:"fire-perf-compat",[fl]:"fire-rc",[dl]:"fire-rc-compat",[ml]:"fire-gcs",[pl]:"fire-gcs-compat",[gl]:"fire-fst",[yl]:"fire-fst-compat",[_l]:"fire-vertex","fire-js":"fire-js",[El]:"fire-js-all"};/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const cn=new Map,Il=new Map,Zr=new Map;function Zi(n,t){try{n.container.addComponent(t)}catch(e){Nt.debug(`Component ${t.name} failed to register with FirebaseApp ${n.name}`,e)}}function Qn(n){const t=n.name;if(Zr.has(t))return Nt.debug(`There were multiple attempts to register component ${t}.`),!1;Zr.set(t,n);for(const e of cn.values())Zi(e,n);for(const e of Il.values())Zi(e,n);return!0}function wl(n,t){const e=n.container.getProvider("heartbeat").getImmediate({optional:!0});return e&&e.triggerHeartbeat(),n.container.getProvider(t)}function Al(n){return n==null?!1:n.settings!==void 0}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rl={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different options or config","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},$t=new oa("app","Firebase",Rl);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Sl{constructor(t,e,r){this._isDeleted=!1,this._options={...t},this._config={...e},this._name=e.name,this._automaticDataCollectionEnabled=e.automaticDataCollectionEnabled,this._container=r,this.container.addComponent(new un("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(t){this.checkDestroyed(),this._automaticDataCollectionEnabled=t}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(t){this._isDeleted=t}checkDestroyed(){if(this.isDeleted)throw $t.create("app-deleted",{appName:this._name})}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Cl=Tl;function bl(n,t={}){let e=n;typeof t!="object"&&(t={name:t});const r={name:Xr,automaticDataCollectionEnabled:!0,...t},i=r.name;if(typeof i!="string"||!i)throw $t.create("bad-app-name",{appName:String(i)});if(e||(e=sa()),!e)throw $t.create("no-options");const o=cn.get(i);if(o){if(Kn(e,o.options)&&Kn(r,o.config))return o;throw $t.create("duplicate-app",{appName:i})}const u=new Vc(i);for(const f of Zr.values())u.addComponent(f);const l=new Sl(e,r,u);return cn.set(i,l),l}function Pl(n=Xr){const t=cn.get(n);if(!t&&n===Xr&&sa())return bl();if(!t)throw $t.create("no-app",{appName:n});return t}function fm(){return Array.from(cn.values())}function Ee(n,t,e){let r=vl[n]??n;e&&(r+=`-${e}`);const i=r.match(/\s|\//),o=t.match(/\s|\//);if(i||o){const u=[`Unable to register library "${r}" with version "${t}":`];i&&u.push(`library name "${r}" contains illegal characters (whitespace or "/")`),i&&o&&u.push("and"),o&&u.push(`version name "${t}" contains illegal characters (whitespace or "/")`),Nt.warn(u.join(" "));return}Qn(new un(`${r}-version`,()=>({library:r,version:t}),"VERSION"))}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Vl="firebase-heartbeat-database",Dl=1,ln="firebase-heartbeat-store";let jr=null;function fa(){return jr||(jr=$c(Vl,Dl,{upgrade:(n,t)=>{switch(t){case 0:try{n.createObjectStore(ln)}catch(e){console.warn(e)}}}}).catch(n=>{throw $t.create("idb-open",{originalErrorMessage:n.message})})),jr}async function Nl(n){try{const e=(await fa()).transaction(ln),r=await e.objectStore(ln).get(da(n));return await e.done,r}catch(t){if(t instanceof Ne)Nt.warn(t.message);else{const e=$t.create("idb-get",{originalErrorMessage:t==null?void 0:t.message});Nt.warn(e.message)}}}async function to(n,t){try{const r=(await fa()).transaction(ln,"readwrite");await r.objectStore(ln).put(t,da(n)),await r.done}catch(e){if(e instanceof Ne)Nt.warn(e.message);else{const r=$t.create("idb-set",{originalErrorMessage:e==null?void 0:e.message});Nt.warn(r.message)}}}function da(n){return`${n.name}!${n.options.appId}`}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const kl=1024,Ol=30;class xl{constructor(t){this.container=t,this._heartbeatsCache=null;const e=this.container.getProvider("app").getImmediate();this._storage=new Ll(e),this._heartbeatsCachePromise=this._storage.read().then(r=>(this._heartbeatsCache=r,r))}async triggerHeartbeat(){var t,e;try{const i=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),o=eo();if(((t=this._heartbeatsCache)==null?void 0:t.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((e=this._heartbeatsCache)==null?void 0:e.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===o||this._heartbeatsCache.heartbeats.some(u=>u.date===o))return;if(this._heartbeatsCache.heartbeats.push({date:o,agent:i}),this._heartbeatsCache.heartbeats.length>Ol){const u=Fl(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(u,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(r){Nt.warn(r)}}async getHeartbeatsHeader(){var t;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((t=this._heartbeatsCache)==null?void 0:t.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const e=eo(),{heartbeatsToSend:r,unsentEntries:i}=Ml(this._heartbeatsCache.heartbeats),o=Gn(JSON.stringify({version:2,heartbeats:r}));return this._heartbeatsCache.lastSentHeartbeatDate=e,i.length>0?(this._heartbeatsCache.heartbeats=i,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),o}catch(e){return Nt.warn(e),""}}}function eo(){return new Date().toISOString().substring(0,10)}function Ml(n,t=kl){const e=[];let r=n.slice();for(const i of n){const o=e.find(u=>u.agent===i.agent);if(o){if(o.dates.push(i.date),no(e)>t){o.dates.pop();break}}else if(e.push({agent:i.agent,dates:[i.date]}),no(e)>t){e.pop();break}r=r.slice(1)}return{heartbeatsToSend:e,unsentEntries:r}}class Ll{constructor(t){this.app=t,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Ic()?wc().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const e=await Nl(this.app);return e!=null&&e.heartbeats?e:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(t){if(await this._canUseIndexedDBPromise){const r=await this.read();return to(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:t.heartbeats})}else return}async add(t){if(await this._canUseIndexedDBPromise){const r=await this.read();return to(this.app,{lastSentHeartbeatDate:t.lastSentHeartbeatDate??r.lastSentHeartbeatDate,heartbeats:[...r.heartbeats,...t.heartbeats]})}else return}}function no(n){return Gn(JSON.stringify({version:2,heartbeats:n})).length}function Fl(n){if(n.length===0)return-1;let t=0,e=n[0].date;for(let r=1;r<n.length;r++)n[r].date<e&&(e=n[r].date,t=r);return t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ul(n){Qn(new un("platform-logger",t=>new Gc(t),"PRIVATE")),Qn(new un("heartbeat",t=>new xl(t),"PRIVATE")),Ee(Yr,Xi,n),Ee(Yr,Xi,"esm2020"),Ee("fire-js","")}Ul("");var Bl="firebase",jl="12.10.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Ee(Bl,jl,"app");var ro=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var zt,ma;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function t(E,m){function g(){}g.prototype=m.prototype,E.F=m.prototype,E.prototype=new g,E.prototype.constructor=E,E.D=function(T,y,w){for(var p=Array(arguments.length-2),Tt=2;Tt<arguments.length;Tt++)p[Tt-2]=arguments[Tt];return m.prototype[y].apply(T,p)}}function e(){this.blockSize=-1}function r(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.C=Array(this.blockSize),this.o=this.h=0,this.u()}t(r,e),r.prototype.u=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function i(E,m,g){g||(g=0);const T=Array(16);if(typeof m=="string")for(var y=0;y<16;++y)T[y]=m.charCodeAt(g++)|m.charCodeAt(g++)<<8|m.charCodeAt(g++)<<16|m.charCodeAt(g++)<<24;else for(y=0;y<16;++y)T[y]=m[g++]|m[g++]<<8|m[g++]<<16|m[g++]<<24;m=E.g[0],g=E.g[1],y=E.g[2];let w=E.g[3],p;p=m+(w^g&(y^w))+T[0]+3614090360&4294967295,m=g+(p<<7&4294967295|p>>>25),p=w+(y^m&(g^y))+T[1]+3905402710&4294967295,w=m+(p<<12&4294967295|p>>>20),p=y+(g^w&(m^g))+T[2]+606105819&4294967295,y=w+(p<<17&4294967295|p>>>15),p=g+(m^y&(w^m))+T[3]+3250441966&4294967295,g=y+(p<<22&4294967295|p>>>10),p=m+(w^g&(y^w))+T[4]+4118548399&4294967295,m=g+(p<<7&4294967295|p>>>25),p=w+(y^m&(g^y))+T[5]+1200080426&4294967295,w=m+(p<<12&4294967295|p>>>20),p=y+(g^w&(m^g))+T[6]+2821735955&4294967295,y=w+(p<<17&4294967295|p>>>15),p=g+(m^y&(w^m))+T[7]+4249261313&4294967295,g=y+(p<<22&4294967295|p>>>10),p=m+(w^g&(y^w))+T[8]+1770035416&4294967295,m=g+(p<<7&4294967295|p>>>25),p=w+(y^m&(g^y))+T[9]+2336552879&4294967295,w=m+(p<<12&4294967295|p>>>20),p=y+(g^w&(m^g))+T[10]+4294925233&4294967295,y=w+(p<<17&4294967295|p>>>15),p=g+(m^y&(w^m))+T[11]+2304563134&4294967295,g=y+(p<<22&4294967295|p>>>10),p=m+(w^g&(y^w))+T[12]+1804603682&4294967295,m=g+(p<<7&4294967295|p>>>25),p=w+(y^m&(g^y))+T[13]+4254626195&4294967295,w=m+(p<<12&4294967295|p>>>20),p=y+(g^w&(m^g))+T[14]+2792965006&4294967295,y=w+(p<<17&4294967295|p>>>15),p=g+(m^y&(w^m))+T[15]+1236535329&4294967295,g=y+(p<<22&4294967295|p>>>10),p=m+(y^w&(g^y))+T[1]+4129170786&4294967295,m=g+(p<<5&4294967295|p>>>27),p=w+(g^y&(m^g))+T[6]+3225465664&4294967295,w=m+(p<<9&4294967295|p>>>23),p=y+(m^g&(w^m))+T[11]+643717713&4294967295,y=w+(p<<14&4294967295|p>>>18),p=g+(w^m&(y^w))+T[0]+3921069994&4294967295,g=y+(p<<20&4294967295|p>>>12),p=m+(y^w&(g^y))+T[5]+3593408605&4294967295,m=g+(p<<5&4294967295|p>>>27),p=w+(g^y&(m^g))+T[10]+38016083&4294967295,w=m+(p<<9&4294967295|p>>>23),p=y+(m^g&(w^m))+T[15]+3634488961&4294967295,y=w+(p<<14&4294967295|p>>>18),p=g+(w^m&(y^w))+T[4]+3889429448&4294967295,g=y+(p<<20&4294967295|p>>>12),p=m+(y^w&(g^y))+T[9]+568446438&4294967295,m=g+(p<<5&4294967295|p>>>27),p=w+(g^y&(m^g))+T[14]+3275163606&4294967295,w=m+(p<<9&4294967295|p>>>23),p=y+(m^g&(w^m))+T[3]+4107603335&4294967295,y=w+(p<<14&4294967295|p>>>18),p=g+(w^m&(y^w))+T[8]+1163531501&4294967295,g=y+(p<<20&4294967295|p>>>12),p=m+(y^w&(g^y))+T[13]+2850285829&4294967295,m=g+(p<<5&4294967295|p>>>27),p=w+(g^y&(m^g))+T[2]+4243563512&4294967295,w=m+(p<<9&4294967295|p>>>23),p=y+(m^g&(w^m))+T[7]+1735328473&4294967295,y=w+(p<<14&4294967295|p>>>18),p=g+(w^m&(y^w))+T[12]+2368359562&4294967295,g=y+(p<<20&4294967295|p>>>12),p=m+(g^y^w)+T[5]+4294588738&4294967295,m=g+(p<<4&4294967295|p>>>28),p=w+(m^g^y)+T[8]+2272392833&4294967295,w=m+(p<<11&4294967295|p>>>21),p=y+(w^m^g)+T[11]+1839030562&4294967295,y=w+(p<<16&4294967295|p>>>16),p=g+(y^w^m)+T[14]+4259657740&4294967295,g=y+(p<<23&4294967295|p>>>9),p=m+(g^y^w)+T[1]+2763975236&4294967295,m=g+(p<<4&4294967295|p>>>28),p=w+(m^g^y)+T[4]+1272893353&4294967295,w=m+(p<<11&4294967295|p>>>21),p=y+(w^m^g)+T[7]+4139469664&4294967295,y=w+(p<<16&4294967295|p>>>16),p=g+(y^w^m)+T[10]+3200236656&4294967295,g=y+(p<<23&4294967295|p>>>9),p=m+(g^y^w)+T[13]+681279174&4294967295,m=g+(p<<4&4294967295|p>>>28),p=w+(m^g^y)+T[0]+3936430074&4294967295,w=m+(p<<11&4294967295|p>>>21),p=y+(w^m^g)+T[3]+3572445317&4294967295,y=w+(p<<16&4294967295|p>>>16),p=g+(y^w^m)+T[6]+76029189&4294967295,g=y+(p<<23&4294967295|p>>>9),p=m+(g^y^w)+T[9]+3654602809&4294967295,m=g+(p<<4&4294967295|p>>>28),p=w+(m^g^y)+T[12]+3873151461&4294967295,w=m+(p<<11&4294967295|p>>>21),p=y+(w^m^g)+T[15]+530742520&4294967295,y=w+(p<<16&4294967295|p>>>16),p=g+(y^w^m)+T[2]+3299628645&4294967295,g=y+(p<<23&4294967295|p>>>9),p=m+(y^(g|~w))+T[0]+4096336452&4294967295,m=g+(p<<6&4294967295|p>>>26),p=w+(g^(m|~y))+T[7]+1126891415&4294967295,w=m+(p<<10&4294967295|p>>>22),p=y+(m^(w|~g))+T[14]+2878612391&4294967295,y=w+(p<<15&4294967295|p>>>17),p=g+(w^(y|~m))+T[5]+4237533241&4294967295,g=y+(p<<21&4294967295|p>>>11),p=m+(y^(g|~w))+T[12]+1700485571&4294967295,m=g+(p<<6&4294967295|p>>>26),p=w+(g^(m|~y))+T[3]+2399980690&4294967295,w=m+(p<<10&4294967295|p>>>22),p=y+(m^(w|~g))+T[10]+4293915773&4294967295,y=w+(p<<15&4294967295|p>>>17),p=g+(w^(y|~m))+T[1]+2240044497&4294967295,g=y+(p<<21&4294967295|p>>>11),p=m+(y^(g|~w))+T[8]+1873313359&4294967295,m=g+(p<<6&4294967295|p>>>26),p=w+(g^(m|~y))+T[15]+4264355552&4294967295,w=m+(p<<10&4294967295|p>>>22),p=y+(m^(w|~g))+T[6]+2734768916&4294967295,y=w+(p<<15&4294967295|p>>>17),p=g+(w^(y|~m))+T[13]+1309151649&4294967295,g=y+(p<<21&4294967295|p>>>11),p=m+(y^(g|~w))+T[4]+4149444226&4294967295,m=g+(p<<6&4294967295|p>>>26),p=w+(g^(m|~y))+T[11]+3174756917&4294967295,w=m+(p<<10&4294967295|p>>>22),p=y+(m^(w|~g))+T[2]+718787259&4294967295,y=w+(p<<15&4294967295|p>>>17),p=g+(w^(y|~m))+T[9]+3951481745&4294967295,E.g[0]=E.g[0]+m&4294967295,E.g[1]=E.g[1]+(y+(p<<21&4294967295|p>>>11))&4294967295,E.g[2]=E.g[2]+y&4294967295,E.g[3]=E.g[3]+w&4294967295}r.prototype.v=function(E,m){m===void 0&&(m=E.length);const g=m-this.blockSize,T=this.C;let y=this.h,w=0;for(;w<m;){if(y==0)for(;w<=g;)i(this,E,w),w+=this.blockSize;if(typeof E=="string"){for(;w<m;)if(T[y++]=E.charCodeAt(w++),y==this.blockSize){i(this,T),y=0;break}}else for(;w<m;)if(T[y++]=E[w++],y==this.blockSize){i(this,T),y=0;break}}this.h=y,this.o+=m},r.prototype.A=function(){var E=Array((this.h<56?this.blockSize:this.blockSize*2)-this.h);E[0]=128;for(var m=1;m<E.length-8;++m)E[m]=0;m=this.o*8;for(var g=E.length-8;g<E.length;++g)E[g]=m&255,m/=256;for(this.v(E),E=Array(16),m=0,g=0;g<4;++g)for(let T=0;T<32;T+=8)E[m++]=this.g[g]>>>T&255;return E};function o(E,m){var g=l;return Object.prototype.hasOwnProperty.call(g,E)?g[E]:g[E]=m(E)}function u(E,m){this.h=m;const g=[];let T=!0;for(let y=E.length-1;y>=0;y--){const w=E[y]|0;T&&w==m||(g[y]=w,T=!1)}this.g=g}var l={};function f(E){return-128<=E&&E<128?o(E,function(m){return new u([m|0],m<0?-1:0)}):new u([E|0],E<0?-1:0)}function d(E){if(isNaN(E)||!isFinite(E))return v;if(E<0)return N(d(-E));const m=[];let g=1;for(let T=0;E>=g;T++)m[T]=E/g|0,g*=4294967296;return new u(m,0)}function _(E,m){if(E.length==0)throw Error("number format error: empty string");if(m=m||10,m<2||36<m)throw Error("radix out of range: "+m);if(E.charAt(0)=="-")return N(_(E.substring(1),m));if(E.indexOf("-")>=0)throw Error('number format error: interior "-" character');const g=d(Math.pow(m,8));let T=v;for(let w=0;w<E.length;w+=8){var y=Math.min(8,E.length-w);const p=parseInt(E.substring(w,w+y),m);y<8?(y=d(Math.pow(m,y)),T=T.j(y).add(d(p))):(T=T.j(g),T=T.add(d(p)))}return T}var v=f(0),R=f(1),C=f(16777216);n=u.prototype,n.m=function(){if(L(this))return-N(this).m();let E=0,m=1;for(let g=0;g<this.g.length;g++){const T=this.i(g);E+=(T>=0?T:4294967296+T)*m,m*=4294967296}return E},n.toString=function(E){if(E=E||10,E<2||36<E)throw Error("radix out of range: "+E);if(O(this))return"0";if(L(this))return"-"+N(this).toString(E);const m=d(Math.pow(E,6));var g=this;let T="";for(;;){const y=Et(g,m).g;g=W(g,y.j(m));let w=((g.g.length>0?g.g[0]:g.h)>>>0).toString(E);if(g=y,O(g))return w+T;for(;w.length<6;)w="0"+w;T=w+T}},n.i=function(E){return E<0?0:E<this.g.length?this.g[E]:this.h};function O(E){if(E.h!=0)return!1;for(let m=0;m<E.g.length;m++)if(E.g[m]!=0)return!1;return!0}function L(E){return E.h==-1}n.l=function(E){return E=W(this,E),L(E)?-1:O(E)?0:1};function N(E){const m=E.g.length,g=[];for(let T=0;T<m;T++)g[T]=~E.g[T];return new u(g,~E.h).add(R)}n.abs=function(){return L(this)?N(this):this},n.add=function(E){const m=Math.max(this.g.length,E.g.length),g=[];let T=0;for(let y=0;y<=m;y++){let w=T+(this.i(y)&65535)+(E.i(y)&65535),p=(w>>>16)+(this.i(y)>>>16)+(E.i(y)>>>16);T=p>>>16,w&=65535,p&=65535,g[y]=p<<16|w}return new u(g,g[g.length-1]&-2147483648?-1:0)};function W(E,m){return E.add(N(m))}n.j=function(E){if(O(this)||O(E))return v;if(L(this))return L(E)?N(this).j(N(E)):N(N(this).j(E));if(L(E))return N(this.j(N(E)));if(this.l(C)<0&&E.l(C)<0)return d(this.m()*E.m());const m=this.g.length+E.g.length,g=[];for(var T=0;T<2*m;T++)g[T]=0;for(T=0;T<this.g.length;T++)for(let y=0;y<E.g.length;y++){const w=this.i(T)>>>16,p=this.i(T)&65535,Tt=E.i(y)>>>16,Zt=E.i(y)&65535;g[2*T+2*y]+=p*Zt,H(g,2*T+2*y),g[2*T+2*y+1]+=w*Zt,H(g,2*T+2*y+1),g[2*T+2*y+1]+=p*Tt,H(g,2*T+2*y+1),g[2*T+2*y+2]+=w*Tt,H(g,2*T+2*y+2)}for(E=0;E<m;E++)g[E]=g[2*E+1]<<16|g[2*E];for(E=m;E<2*m;E++)g[E]=0;return new u(g,0)};function H(E,m){for(;(E[m]&65535)!=E[m];)E[m+1]+=E[m]>>>16,E[m]&=65535,m++}function J(E,m){this.g=E,this.h=m}function Et(E,m){if(O(m))throw Error("division by zero");if(O(E))return new J(v,v);if(L(E))return m=Et(N(E),m),new J(N(m.g),N(m.h));if(L(m))return m=Et(E,N(m)),new J(N(m.g),m.h);if(E.g.length>30){if(L(E)||L(m))throw Error("slowDivide_ only works with positive integers.");for(var g=R,T=m;T.l(E)<=0;)g=lt(g),T=lt(T);var y=ht(g,1),w=ht(T,1);for(T=ht(T,2),g=ht(g,2);!O(T);){var p=w.add(T);p.l(E)<=0&&(y=y.add(g),w=p),T=ht(T,1),g=ht(g,1)}return m=W(E,y.j(m)),new J(y,m)}for(y=v;E.l(m)>=0;){for(g=Math.max(1,Math.floor(E.m()/m.m())),T=Math.ceil(Math.log(g)/Math.LN2),T=T<=48?1:Math.pow(2,T-48),w=d(g),p=w.j(m);L(p)||p.l(E)>0;)g-=T,w=d(g),p=w.j(m);O(w)&&(w=R),y=y.add(w),E=W(E,p)}return new J(y,E)}n.B=function(E){return Et(this,E).h},n.and=function(E){const m=Math.max(this.g.length,E.g.length),g=[];for(let T=0;T<m;T++)g[T]=this.i(T)&E.i(T);return new u(g,this.h&E.h)},n.or=function(E){const m=Math.max(this.g.length,E.g.length),g=[];for(let T=0;T<m;T++)g[T]=this.i(T)|E.i(T);return new u(g,this.h|E.h)},n.xor=function(E){const m=Math.max(this.g.length,E.g.length),g=[];for(let T=0;T<m;T++)g[T]=this.i(T)^E.i(T);return new u(g,this.h^E.h)};function lt(E){const m=E.g.length+1,g=[];for(let T=0;T<m;T++)g[T]=E.i(T)<<1|E.i(T-1)>>>31;return new u(g,E.h)}function ht(E,m){const g=m>>5;m%=32;const T=E.g.length-g,y=[];for(let w=0;w<T;w++)y[w]=m>0?E.i(w+g)>>>m|E.i(w+g+1)<<32-m:E.i(w+g);return new u(y,E.h)}r.prototype.digest=r.prototype.A,r.prototype.reset=r.prototype.u,r.prototype.update=r.prototype.v,ma=r,u.prototype.add=u.prototype.add,u.prototype.multiply=u.prototype.j,u.prototype.modulo=u.prototype.B,u.prototype.compare=u.prototype.l,u.prototype.toNumber=u.prototype.m,u.prototype.toString=u.prototype.toString,u.prototype.getBits=u.prototype.i,u.fromNumber=d,u.fromString=_,zt=u}).apply(typeof ro<"u"?ro:typeof self<"u"?self:typeof window<"u"?window:{});var xn=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var pa,Ze,ga,jn,ts,_a,ya,Ea;(function(){var n,t=Object.defineProperty;function e(s){s=[typeof globalThis=="object"&&globalThis,s,typeof window=="object"&&window,typeof self=="object"&&self,typeof xn=="object"&&xn];for(var a=0;a<s.length;++a){var c=s[a];if(c&&c.Math==Math)return c}throw Error("Cannot find global object")}var r=e(this);function i(s,a){if(a)t:{var c=r;s=s.split(".");for(var h=0;h<s.length-1;h++){var I=s[h];if(!(I in c))break t;c=c[I]}s=s[s.length-1],h=c[s],a=a(h),a!=h&&a!=null&&t(c,s,{configurable:!0,writable:!0,value:a})}}i("Symbol.dispose",function(s){return s||Symbol("Symbol.dispose")}),i("Array.prototype.values",function(s){return s||function(){return this[Symbol.iterator]()}}),i("Object.entries",function(s){return s||function(a){var c=[],h;for(h in a)Object.prototype.hasOwnProperty.call(a,h)&&c.push([h,a[h]]);return c}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var o=o||{},u=this||self;function l(s){var a=typeof s;return a=="object"&&s!=null||a=="function"}function f(s,a,c){return s.call.apply(s.bind,arguments)}function d(s,a,c){return d=f,d.apply(null,arguments)}function _(s,a){var c=Array.prototype.slice.call(arguments,1);return function(){var h=c.slice();return h.push.apply(h,arguments),s.apply(this,h)}}function v(s,a){function c(){}c.prototype=a.prototype,s.Z=a.prototype,s.prototype=new c,s.prototype.constructor=s,s.Ob=function(h,I,A){for(var b=Array(arguments.length-2),F=2;F<arguments.length;F++)b[F-2]=arguments[F];return a.prototype[I].apply(h,b)}}var R=typeof AsyncContext<"u"&&typeof AsyncContext.Snapshot=="function"?s=>s&&AsyncContext.Snapshot.wrap(s):s=>s;function C(s){const a=s.length;if(a>0){const c=Array(a);for(let h=0;h<a;h++)c[h]=s[h];return c}return[]}function O(s,a){for(let h=1;h<arguments.length;h++){const I=arguments[h];var c=typeof I;if(c=c!="object"?c:I?Array.isArray(I)?"array":c:"null",c=="array"||c=="object"&&typeof I.length=="number"){c=s.length||0;const A=I.length||0;s.length=c+A;for(let b=0;b<A;b++)s[c+b]=I[b]}else s.push(I)}}class L{constructor(a,c){this.i=a,this.j=c,this.h=0,this.g=null}get(){let a;return this.h>0?(this.h--,a=this.g,this.g=a.next,a.next=null):a=this.i(),a}}function N(s){u.setTimeout(()=>{throw s},0)}function W(){var s=E;let a=null;return s.g&&(a=s.g,s.g=s.g.next,s.g||(s.h=null),a.next=null),a}class H{constructor(){this.h=this.g=null}add(a,c){const h=J.get();h.set(a,c),this.h?this.h.next=h:this.g=h,this.h=h}}var J=new L(()=>new Et,s=>s.reset());class Et{constructor(){this.next=this.g=this.h=null}set(a,c){this.h=a,this.g=c,this.next=null}reset(){this.next=this.g=this.h=null}}let lt,ht=!1,E=new H,m=()=>{const s=Promise.resolve(void 0);lt=()=>{s.then(g)}};function g(){for(var s;s=W();){try{s.h.call(s.g)}catch(c){N(c)}var a=J;a.j(s),a.h<100&&(a.h++,s.next=a.g,a.g=s)}ht=!1}function T(){this.u=this.u,this.C=this.C}T.prototype.u=!1,T.prototype.dispose=function(){this.u||(this.u=!0,this.N())},T.prototype[Symbol.dispose]=function(){this.dispose()},T.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function y(s,a){this.type=s,this.g=this.target=a,this.defaultPrevented=!1}y.prototype.h=function(){this.defaultPrevented=!0};var w=function(){if(!u.addEventListener||!Object.defineProperty)return!1;var s=!1,a=Object.defineProperty({},"passive",{get:function(){s=!0}});try{const c=()=>{};u.addEventListener("test",c,a),u.removeEventListener("test",c,a)}catch{}return s}();function p(s){return/^[\s\xa0]*$/.test(s)}function Tt(s,a){y.call(this,s?s.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,s&&this.init(s,a)}v(Tt,y),Tt.prototype.init=function(s,a){const c=this.type=s.type,h=s.changedTouches&&s.changedTouches.length?s.changedTouches[0]:null;this.target=s.target||s.srcElement,this.g=a,a=s.relatedTarget,a||(c=="mouseover"?a=s.fromElement:c=="mouseout"&&(a=s.toElement)),this.relatedTarget=a,h?(this.clientX=h.clientX!==void 0?h.clientX:h.pageX,this.clientY=h.clientY!==void 0?h.clientY:h.pageY,this.screenX=h.screenX||0,this.screenY=h.screenY||0):(this.clientX=s.clientX!==void 0?s.clientX:s.pageX,this.clientY=s.clientY!==void 0?s.clientY:s.pageY,this.screenX=s.screenX||0,this.screenY=s.screenY||0),this.button=s.button,this.key=s.key||"",this.ctrlKey=s.ctrlKey,this.altKey=s.altKey,this.shiftKey=s.shiftKey,this.metaKey=s.metaKey,this.pointerId=s.pointerId||0,this.pointerType=s.pointerType,this.state=s.state,this.i=s,s.defaultPrevented&&Tt.Z.h.call(this)},Tt.prototype.h=function(){Tt.Z.h.call(this);const s=this.i;s.preventDefault?s.preventDefault():s.returnValue=!1};var Zt="closure_listenable_"+(Math.random()*1e6|0),wu=0;function Au(s,a,c,h,I){this.listener=s,this.proxy=null,this.src=a,this.type=c,this.capture=!!h,this.ha=I,this.key=++wu,this.da=this.fa=!1}function Tn(s){s.da=!0,s.listener=null,s.proxy=null,s.src=null,s.ha=null}function vn(s,a,c){for(const h in s)a.call(c,s[h],h,s)}function Ru(s,a){for(const c in s)a.call(void 0,s[c],c,s)}function zs(s){const a={};for(const c in s)a[c]=s[c];return a}const Hs="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function Gs(s,a){let c,h;for(let I=1;I<arguments.length;I++){h=arguments[I];for(c in h)s[c]=h[c];for(let A=0;A<Hs.length;A++)c=Hs[A],Object.prototype.hasOwnProperty.call(h,c)&&(s[c]=h[c])}}function In(s){this.src=s,this.g={},this.h=0}In.prototype.add=function(s,a,c,h,I){const A=s.toString();s=this.g[A],s||(s=this.g[A]=[],this.h++);const b=pr(s,a,h,I);return b>-1?(a=s[b],c||(a.fa=!1)):(a=new Au(a,this.src,A,!!h,I),a.fa=c,s.push(a)),a};function mr(s,a){const c=a.type;if(c in s.g){var h=s.g[c],I=Array.prototype.indexOf.call(h,a,void 0),A;(A=I>=0)&&Array.prototype.splice.call(h,I,1),A&&(Tn(a),s.g[c].length==0&&(delete s.g[c],s.h--))}}function pr(s,a,c,h){for(let I=0;I<s.length;++I){const A=s[I];if(!A.da&&A.listener==a&&A.capture==!!c&&A.ha==h)return I}return-1}var gr="closure_lm_"+(Math.random()*1e6|0),_r={};function Ks(s,a,c,h,I){if(Array.isArray(a)){for(let A=0;A<a.length;A++)Ks(s,a[A],c,h,I);return null}return c=Js(c),s&&s[Zt]?s.J(a,c,l(h)?!!h.capture:!1,I):Su(s,a,c,!1,h,I)}function Su(s,a,c,h,I,A){if(!a)throw Error("Invalid event type");const b=l(I)?!!I.capture:!!I;let F=Er(s);if(F||(s[gr]=F=new In(s)),c=F.add(a,c,h,b,A),c.proxy)return c;if(h=Cu(),c.proxy=h,h.src=s,h.listener=c,s.addEventListener)w||(I=b),I===void 0&&(I=!1),s.addEventListener(a.toString(),h,I);else if(s.attachEvent)s.attachEvent(Ws(a.toString()),h);else if(s.addListener&&s.removeListener)s.addListener(h);else throw Error("addEventListener and attachEvent are unavailable.");return c}function Cu(){function s(c){return a.call(s.src,s.listener,c)}const a=bu;return s}function Qs(s,a,c,h,I){if(Array.isArray(a))for(var A=0;A<a.length;A++)Qs(s,a[A],c,h,I);else h=l(h)?!!h.capture:!!h,c=Js(c),s&&s[Zt]?(s=s.i,A=String(a).toString(),A in s.g&&(a=s.g[A],c=pr(a,c,h,I),c>-1&&(Tn(a[c]),Array.prototype.splice.call(a,c,1),a.length==0&&(delete s.g[A],s.h--)))):s&&(s=Er(s))&&(a=s.g[a.toString()],s=-1,a&&(s=pr(a,c,h,I)),(c=s>-1?a[s]:null)&&yr(c))}function yr(s){if(typeof s!="number"&&s&&!s.da){var a=s.src;if(a&&a[Zt])mr(a.i,s);else{var c=s.type,h=s.proxy;a.removeEventListener?a.removeEventListener(c,h,s.capture):a.detachEvent?a.detachEvent(Ws(c),h):a.addListener&&a.removeListener&&a.removeListener(h),(c=Er(a))?(mr(c,s),c.h==0&&(c.src=null,a[gr]=null)):Tn(s)}}}function Ws(s){return s in _r?_r[s]:_r[s]="on"+s}function bu(s,a){if(s.da)s=!0;else{a=new Tt(a,this);const c=s.listener,h=s.ha||s.src;s.fa&&yr(s),s=c.call(h,a)}return s}function Er(s){return s=s[gr],s instanceof In?s:null}var Tr="__closure_events_fn_"+(Math.random()*1e9>>>0);function Js(s){return typeof s=="function"?s:(s[Tr]||(s[Tr]=function(a){return s.handleEvent(a)}),s[Tr])}function ft(){T.call(this),this.i=new In(this),this.M=this,this.G=null}v(ft,T),ft.prototype[Zt]=!0,ft.prototype.removeEventListener=function(s,a,c,h){Qs(this,s,a,c,h)};function gt(s,a){var c,h=s.G;if(h)for(c=[];h;h=h.G)c.push(h);if(s=s.M,h=a.type||a,typeof a=="string")a=new y(a,s);else if(a instanceof y)a.target=a.target||s;else{var I=a;a=new y(h,s),Gs(a,I)}I=!0;let A,b;if(c)for(b=c.length-1;b>=0;b--)A=a.g=c[b],I=wn(A,h,!0,a)&&I;if(A=a.g=s,I=wn(A,h,!0,a)&&I,I=wn(A,h,!1,a)&&I,c)for(b=0;b<c.length;b++)A=a.g=c[b],I=wn(A,h,!1,a)&&I}ft.prototype.N=function(){if(ft.Z.N.call(this),this.i){var s=this.i;for(const a in s.g){const c=s.g[a];for(let h=0;h<c.length;h++)Tn(c[h]);delete s.g[a],s.h--}}this.G=null},ft.prototype.J=function(s,a,c,h){return this.i.add(String(s),a,!1,c,h)},ft.prototype.K=function(s,a,c,h){return this.i.add(String(s),a,!0,c,h)};function wn(s,a,c,h){if(a=s.i.g[String(a)],!a)return!0;a=a.concat();let I=!0;for(let A=0;A<a.length;++A){const b=a[A];if(b&&!b.da&&b.capture==c){const F=b.listener,rt=b.ha||b.src;b.fa&&mr(s.i,b),I=F.call(rt,h)!==!1&&I}}return I&&!h.defaultPrevented}function Pu(s,a){if(typeof s!="function")if(s&&typeof s.handleEvent=="function")s=d(s.handleEvent,s);else throw Error("Invalid listener argument");return Number(a)>2147483647?-1:u.setTimeout(s,a||0)}function Ys(s){s.g=Pu(()=>{s.g=null,s.i&&(s.i=!1,Ys(s))},s.l);const a=s.h;s.h=null,s.m.apply(null,a)}class Vu extends T{constructor(a,c){super(),this.m=a,this.l=c,this.h=null,this.i=!1,this.g=null}j(a){this.h=arguments,this.g?this.i=!0:Ys(this)}N(){super.N(),this.g&&(u.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function Me(s){T.call(this),this.h=s,this.g={}}v(Me,T);var Xs=[];function Zs(s){vn(s.g,function(a,c){this.g.hasOwnProperty(c)&&yr(a)},s),s.g={}}Me.prototype.N=function(){Me.Z.N.call(this),Zs(this)},Me.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var vr=u.JSON.stringify,Du=u.JSON.parse,Nu=class{stringify(s){return u.JSON.stringify(s,void 0)}parse(s){return u.JSON.parse(s,void 0)}};function ti(){}function ei(){}var Le={OPEN:"a",hb:"b",ERROR:"c",tb:"d"};function Ir(){y.call(this,"d")}v(Ir,y);function wr(){y.call(this,"c")}v(wr,y);var te={},ni=null;function An(){return ni=ni||new ft}te.Ia="serverreachability";function ri(s){y.call(this,te.Ia,s)}v(ri,y);function Fe(s){const a=An();gt(a,new ri(a))}te.STAT_EVENT="statevent";function si(s,a){y.call(this,te.STAT_EVENT,s),this.stat=a}v(si,y);function _t(s){const a=An();gt(a,new si(a,s))}te.Ja="timingevent";function ii(s,a){y.call(this,te.Ja,s),this.size=a}v(ii,y);function Ue(s,a){if(typeof s!="function")throw Error("Fn must not be null and must be a function");return u.setTimeout(function(){s()},a)}function Be(){this.g=!0}Be.prototype.ua=function(){this.g=!1};function ku(s,a,c,h,I,A){s.info(function(){if(s.g)if(A){var b="",F=A.split("&");for(let z=0;z<F.length;z++){var rt=F[z].split("=");if(rt.length>1){const ot=rt[0];rt=rt[1];const Rt=ot.split("_");b=Rt.length>=2&&Rt[1]=="type"?b+(ot+"="+rt+"&"):b+(ot+"=redacted&")}}}else b=null;else b=A;return"XMLHTTP REQ ("+h+") [attempt "+I+"]: "+a+`
`+c+`
`+b})}function Ou(s,a,c,h,I,A,b){s.info(function(){return"XMLHTTP RESP ("+h+") [ attempt "+I+"]: "+a+`
`+c+`
`+A+" "+b})}function fe(s,a,c,h){s.info(function(){return"XMLHTTP TEXT ("+a+"): "+Mu(s,c)+(h?" "+h:"")})}function xu(s,a){s.info(function(){return"TIMEOUT: "+a})}Be.prototype.info=function(){};function Mu(s,a){if(!s.g)return a;if(!a)return null;try{const A=JSON.parse(a);if(A){for(s=0;s<A.length;s++)if(Array.isArray(A[s])){var c=A[s];if(!(c.length<2)){var h=c[1];if(Array.isArray(h)&&!(h.length<1)){var I=h[0];if(I!="noop"&&I!="stop"&&I!="close")for(let b=1;b<h.length;b++)h[b]=""}}}}return vr(A)}catch{return a}}var Rn={NO_ERROR:0,cb:1,qb:2,pb:3,kb:4,ob:5,rb:6,Ga:7,TIMEOUT:8,ub:9},oi={ib:"complete",Fb:"success",ERROR:"error",Ga:"abort",xb:"ready",yb:"readystatechange",TIMEOUT:"timeout",sb:"incrementaldata",wb:"progress",lb:"downloadprogress",Nb:"uploadprogress"},ai;function Ar(){}v(Ar,ti),Ar.prototype.g=function(){return new XMLHttpRequest},ai=new Ar;function je(s){return encodeURIComponent(String(s))}function Lu(s){var a=1;s=s.split(":");const c=[];for(;a>0&&s.length;)c.push(s.shift()),a--;return s.length&&c.push(s.join(":")),c}function Ot(s,a,c,h){this.j=s,this.i=a,this.l=c,this.S=h||1,this.V=new Me(this),this.H=45e3,this.J=null,this.o=!1,this.u=this.B=this.A=this.M=this.F=this.T=this.D=null,this.G=[],this.g=null,this.C=0,this.m=this.v=null,this.X=-1,this.K=!1,this.P=0,this.O=null,this.W=this.L=this.U=this.R=!1,this.h=new ui}function ui(){this.i=null,this.g="",this.h=!1}var ci={},Rr={};function Sr(s,a,c){s.M=1,s.A=Cn(At(a)),s.u=c,s.R=!0,li(s,null)}function li(s,a){s.F=Date.now(),Sn(s),s.B=At(s.A);var c=s.B,h=s.S;Array.isArray(h)||(h=[String(h)]),wi(c.i,"t",h),s.C=0,c=s.j.L,s.h=new ui,s.g=ji(s.j,c?a:null,!s.u),s.P>0&&(s.O=new Vu(d(s.Y,s,s.g),s.P)),a=s.V,c=s.g,h=s.ba;var I="readystatechange";Array.isArray(I)||(I&&(Xs[0]=I.toString()),I=Xs);for(let A=0;A<I.length;A++){const b=Ks(c,I[A],h||a.handleEvent,!1,a.h||a);if(!b)break;a.g[b.key]=b}a=s.J?zs(s.J):{},s.u?(s.v||(s.v="POST"),a["Content-Type"]="application/x-www-form-urlencoded",s.g.ea(s.B,s.v,s.u,a)):(s.v="GET",s.g.ea(s.B,s.v,null,a)),Fe(),ku(s.i,s.v,s.B,s.l,s.S,s.u)}Ot.prototype.ba=function(s){s=s.target;const a=this.O;a&&Lt(s)==3?a.j():this.Y(s)},Ot.prototype.Y=function(s){try{if(s==this.g)t:{const F=Lt(this.g),rt=this.g.ya(),z=this.g.ca();if(!(F<3)&&(F!=3||this.g&&(this.h.h||this.g.la()||Vi(this.g)))){this.K||F!=4||rt==7||(rt==8||z<=0?Fe(3):Fe(2)),Cr(this);var a=this.g.ca();this.X=a;var c=Fu(this);if(this.o=a==200,Ou(this.i,this.v,this.B,this.l,this.S,F,a),this.o){if(this.U&&!this.L){e:{if(this.g){var h,I=this.g;if((h=I.g?I.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!p(h)){var A=h;break e}}A=null}if(s=A)fe(this.i,this.l,s,"Initial handshake response via X-HTTP-Initial-Response"),this.L=!0,br(this,s);else{this.o=!1,this.m=3,_t(12),ee(this),qe(this);break t}}if(this.R){s=!0;let ot;for(;!this.K&&this.C<c.length;)if(ot=Uu(this,c),ot==Rr){F==4&&(this.m=4,_t(14),s=!1),fe(this.i,this.l,null,"[Incomplete Response]");break}else if(ot==ci){this.m=4,_t(15),fe(this.i,this.l,c,"[Invalid Chunk]"),s=!1;break}else fe(this.i,this.l,ot,null),br(this,ot);if(hi(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),F!=4||c.length!=0||this.h.h||(this.m=1,_t(16),s=!1),this.o=this.o&&s,!s)fe(this.i,this.l,c,"[Invalid Chunked Response]"),ee(this),qe(this);else if(c.length>0&&!this.W){this.W=!0;var b=this.j;b.g==this&&b.aa&&!b.P&&(b.j.info("Great, no buffering proxy detected. Bytes received: "+c.length),Mr(b),b.P=!0,_t(11))}}else fe(this.i,this.l,c,null),br(this,c);F==4&&ee(this),this.o&&!this.K&&(F==4?Li(this.j,this):(this.o=!1,Sn(this)))}else Zu(this.g),a==400&&c.indexOf("Unknown SID")>0?(this.m=3,_t(12)):(this.m=0,_t(13)),ee(this),qe(this)}}}catch{}finally{}};function Fu(s){if(!hi(s))return s.g.la();const a=Vi(s.g);if(a==="")return"";let c="";const h=a.length,I=Lt(s.g)==4;if(!s.h.i){if(typeof TextDecoder>"u")return ee(s),qe(s),"";s.h.i=new u.TextDecoder}for(let A=0;A<h;A++)s.h.h=!0,c+=s.h.i.decode(a[A],{stream:!(I&&A==h-1)});return a.length=0,s.h.g+=c,s.C=0,s.h.g}function hi(s){return s.g?s.v=="GET"&&s.M!=2&&s.j.Aa:!1}function Uu(s,a){var c=s.C,h=a.indexOf(`
`,c);return h==-1?Rr:(c=Number(a.substring(c,h)),isNaN(c)?ci:(h+=1,h+c>a.length?Rr:(a=a.slice(h,h+c),s.C=h+c,a)))}Ot.prototype.cancel=function(){this.K=!0,ee(this)};function Sn(s){s.T=Date.now()+s.H,fi(s,s.H)}function fi(s,a){if(s.D!=null)throw Error("WatchDog timer not null");s.D=Ue(d(s.aa,s),a)}function Cr(s){s.D&&(u.clearTimeout(s.D),s.D=null)}Ot.prototype.aa=function(){this.D=null;const s=Date.now();s-this.T>=0?(xu(this.i,this.B),this.M!=2&&(Fe(),_t(17)),ee(this),this.m=2,qe(this)):fi(this,this.T-s)};function qe(s){s.j.I==0||s.K||Li(s.j,s)}function ee(s){Cr(s);var a=s.O;a&&typeof a.dispose=="function"&&a.dispose(),s.O=null,Zs(s.V),s.g&&(a=s.g,s.g=null,a.abort(),a.dispose())}function br(s,a){try{var c=s.j;if(c.I!=0&&(c.g==s||Pr(c.h,s))){if(!s.L&&Pr(c.h,s)&&c.I==3){try{var h=c.Ba.g.parse(a)}catch{h=null}if(Array.isArray(h)&&h.length==3){var I=h;if(I[0]==0){t:if(!c.v){if(c.g)if(c.g.F+3e3<s.F)Nn(c),Vn(c);else break t;xr(c),_t(18)}}else c.xa=I[1],0<c.xa-c.K&&I[2]<37500&&c.F&&c.A==0&&!c.C&&(c.C=Ue(d(c.Va,c),6e3));pi(c.h)<=1&&c.ta&&(c.ta=void 0)}else re(c,11)}else if((s.L||c.g==s)&&Nn(c),!p(a))for(I=c.Ba.g.parse(a),a=0;a<I.length;a++){let z=I[a];const ot=z[0];if(!(ot<=c.K))if(c.K=ot,z=z[1],c.I==2)if(z[0]=="c"){c.M=z[1],c.ba=z[2];const Rt=z[3];Rt!=null&&(c.ka=Rt,c.j.info("VER="+c.ka));const se=z[4];se!=null&&(c.za=se,c.j.info("SVER="+c.za));const Ft=z[5];Ft!=null&&typeof Ft=="number"&&Ft>0&&(h=1.5*Ft,c.O=h,c.j.info("backChannelRequestTimeoutMs_="+h)),h=c;const Ut=s.g;if(Ut){const On=Ut.g?Ut.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(On){var A=h.h;A.g||On.indexOf("spdy")==-1&&On.indexOf("quic")==-1&&On.indexOf("h2")==-1||(A.j=A.l,A.g=new Set,A.h&&(Vr(A,A.h),A.h=null))}if(h.G){const Lr=Ut.g?Ut.g.getResponseHeader("X-HTTP-Session-Id"):null;Lr&&(h.wa=Lr,G(h.J,h.G,Lr))}}c.I=3,c.l&&c.l.ra(),c.aa&&(c.T=Date.now()-s.F,c.j.info("Handshake RTT: "+c.T+"ms")),h=c;var b=s;if(h.na=Bi(h,h.L?h.ba:null,h.W),b.L){gi(h.h,b);var F=b,rt=h.O;rt&&(F.H=rt),F.D&&(Cr(F),Sn(F)),h.g=b}else xi(h);c.i.length>0&&Dn(c)}else z[0]!="stop"&&z[0]!="close"||re(c,7);else c.I==3&&(z[0]=="stop"||z[0]=="close"?z[0]=="stop"?re(c,7):Or(c):z[0]!="noop"&&c.l&&c.l.qa(z),c.A=0)}}Fe(4)}catch{}}var Bu=class{constructor(s,a){this.g=s,this.map=a}};function di(s){this.l=s||10,u.PerformanceNavigationTiming?(s=u.performance.getEntriesByType("navigation"),s=s.length>0&&(s[0].nextHopProtocol=="hq"||s[0].nextHopProtocol=="h2")):s=!!(u.chrome&&u.chrome.loadTimes&&u.chrome.loadTimes()&&u.chrome.loadTimes().wasFetchedViaSpdy),this.j=s?this.l:1,this.g=null,this.j>1&&(this.g=new Set),this.h=null,this.i=[]}function mi(s){return s.h?!0:s.g?s.g.size>=s.j:!1}function pi(s){return s.h?1:s.g?s.g.size:0}function Pr(s,a){return s.h?s.h==a:s.g?s.g.has(a):!1}function Vr(s,a){s.g?s.g.add(a):s.h=a}function gi(s,a){s.h&&s.h==a?s.h=null:s.g&&s.g.has(a)&&s.g.delete(a)}di.prototype.cancel=function(){if(this.i=_i(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const s of this.g.values())s.cancel();this.g.clear()}};function _i(s){if(s.h!=null)return s.i.concat(s.h.G);if(s.g!=null&&s.g.size!==0){let a=s.i;for(const c of s.g.values())a=a.concat(c.G);return a}return C(s.i)}var yi=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function ju(s,a){if(s){s=s.split("&");for(let c=0;c<s.length;c++){const h=s[c].indexOf("=");let I,A=null;h>=0?(I=s[c].substring(0,h),A=s[c].substring(h+1)):I=s[c],a(I,A?decodeURIComponent(A.replace(/\+/g," ")):"")}}}function xt(s){this.g=this.o=this.j="",this.u=null,this.m=this.h="",this.l=!1;let a;s instanceof xt?(this.l=s.l,$e(this,s.j),this.o=s.o,this.g=s.g,ze(this,s.u),this.h=s.h,Dr(this,Ai(s.i)),this.m=s.m):s&&(a=String(s).match(yi))?(this.l=!1,$e(this,a[1]||"",!0),this.o=He(a[2]||""),this.g=He(a[3]||"",!0),ze(this,a[4]),this.h=He(a[5]||"",!0),Dr(this,a[6]||"",!0),this.m=He(a[7]||"")):(this.l=!1,this.i=new Ke(null,this.l))}xt.prototype.toString=function(){const s=[];var a=this.j;a&&s.push(Ge(a,Ei,!0),":");var c=this.g;return(c||a=="file")&&(s.push("//"),(a=this.o)&&s.push(Ge(a,Ei,!0),"@"),s.push(je(c).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),c=this.u,c!=null&&s.push(":",String(c))),(c=this.h)&&(this.g&&c.charAt(0)!="/"&&s.push("/"),s.push(Ge(c,c.charAt(0)=="/"?zu:$u,!0))),(c=this.i.toString())&&s.push("?",c),(c=this.m)&&s.push("#",Ge(c,Gu)),s.join("")},xt.prototype.resolve=function(s){const a=At(this);let c=!!s.j;c?$e(a,s.j):c=!!s.o,c?a.o=s.o:c=!!s.g,c?a.g=s.g:c=s.u!=null;var h=s.h;if(c)ze(a,s.u);else if(c=!!s.h){if(h.charAt(0)!="/")if(this.g&&!this.h)h="/"+h;else{var I=a.h.lastIndexOf("/");I!=-1&&(h=a.h.slice(0,I+1)+h)}if(I=h,I==".."||I==".")h="";else if(I.indexOf("./")!=-1||I.indexOf("/.")!=-1){h=I.lastIndexOf("/",0)==0,I=I.split("/");const A=[];for(let b=0;b<I.length;){const F=I[b++];F=="."?h&&b==I.length&&A.push(""):F==".."?((A.length>1||A.length==1&&A[0]!="")&&A.pop(),h&&b==I.length&&A.push("")):(A.push(F),h=!0)}h=A.join("/")}else h=I}return c?a.h=h:c=s.i.toString()!=="",c?Dr(a,Ai(s.i)):c=!!s.m,c&&(a.m=s.m),a};function At(s){return new xt(s)}function $e(s,a,c){s.j=c?He(a,!0):a,s.j&&(s.j=s.j.replace(/:$/,""))}function ze(s,a){if(a){if(a=Number(a),isNaN(a)||a<0)throw Error("Bad port number "+a);s.u=a}else s.u=null}function Dr(s,a,c){a instanceof Ke?(s.i=a,Ku(s.i,s.l)):(c||(a=Ge(a,Hu)),s.i=new Ke(a,s.l))}function G(s,a,c){s.i.set(a,c)}function Cn(s){return G(s,"zx",Math.floor(Math.random()*2147483648).toString(36)+Math.abs(Math.floor(Math.random()*2147483648)^Date.now()).toString(36)),s}function He(s,a){return s?a?decodeURI(s.replace(/%25/g,"%2525")):decodeURIComponent(s):""}function Ge(s,a,c){return typeof s=="string"?(s=encodeURI(s).replace(a,qu),c&&(s=s.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),s):null}function qu(s){return s=s.charCodeAt(0),"%"+(s>>4&15).toString(16)+(s&15).toString(16)}var Ei=/[#\/\?@]/g,$u=/[#\?:]/g,zu=/[#\?]/g,Hu=/[#\?@]/g,Gu=/#/g;function Ke(s,a){this.h=this.g=null,this.i=s||null,this.j=!!a}function ne(s){s.g||(s.g=new Map,s.h=0,s.i&&ju(s.i,function(a,c){s.add(decodeURIComponent(a.replace(/\+/g," ")),c)}))}n=Ke.prototype,n.add=function(s,a){ne(this),this.i=null,s=de(this,s);let c=this.g.get(s);return c||this.g.set(s,c=[]),c.push(a),this.h+=1,this};function Ti(s,a){ne(s),a=de(s,a),s.g.has(a)&&(s.i=null,s.h-=s.g.get(a).length,s.g.delete(a))}function vi(s,a){return ne(s),a=de(s,a),s.g.has(a)}n.forEach=function(s,a){ne(this),this.g.forEach(function(c,h){c.forEach(function(I){s.call(a,I,h,this)},this)},this)};function Ii(s,a){ne(s);let c=[];if(typeof a=="string")vi(s,a)&&(c=c.concat(s.g.get(de(s,a))));else for(s=Array.from(s.g.values()),a=0;a<s.length;a++)c=c.concat(s[a]);return c}n.set=function(s,a){return ne(this),this.i=null,s=de(this,s),vi(this,s)&&(this.h-=this.g.get(s).length),this.g.set(s,[a]),this.h+=1,this},n.get=function(s,a){return s?(s=Ii(this,s),s.length>0?String(s[0]):a):a};function wi(s,a,c){Ti(s,a),c.length>0&&(s.i=null,s.g.set(de(s,a),C(c)),s.h+=c.length)}n.toString=function(){if(this.i)return this.i;if(!this.g)return"";const s=[],a=Array.from(this.g.keys());for(let h=0;h<a.length;h++){var c=a[h];const I=je(c);c=Ii(this,c);for(let A=0;A<c.length;A++){let b=I;c[A]!==""&&(b+="="+je(c[A])),s.push(b)}}return this.i=s.join("&")};function Ai(s){const a=new Ke;return a.i=s.i,s.g&&(a.g=new Map(s.g),a.h=s.h),a}function de(s,a){return a=String(a),s.j&&(a=a.toLowerCase()),a}function Ku(s,a){a&&!s.j&&(ne(s),s.i=null,s.g.forEach(function(c,h){const I=h.toLowerCase();h!=I&&(Ti(this,h),wi(this,I,c))},s)),s.j=a}function Qu(s,a){const c=new Be;if(u.Image){const h=new Image;h.onload=_(Mt,c,"TestLoadImage: loaded",!0,a,h),h.onerror=_(Mt,c,"TestLoadImage: error",!1,a,h),h.onabort=_(Mt,c,"TestLoadImage: abort",!1,a,h),h.ontimeout=_(Mt,c,"TestLoadImage: timeout",!1,a,h),u.setTimeout(function(){h.ontimeout&&h.ontimeout()},1e4),h.src=s}else a(!1)}function Wu(s,a){const c=new Be,h=new AbortController,I=setTimeout(()=>{h.abort(),Mt(c,"TestPingServer: timeout",!1,a)},1e4);fetch(s,{signal:h.signal}).then(A=>{clearTimeout(I),A.ok?Mt(c,"TestPingServer: ok",!0,a):Mt(c,"TestPingServer: server error",!1,a)}).catch(()=>{clearTimeout(I),Mt(c,"TestPingServer: error",!1,a)})}function Mt(s,a,c,h,I){try{I&&(I.onload=null,I.onerror=null,I.onabort=null,I.ontimeout=null),h(c)}catch{}}function Ju(){this.g=new Nu}function Nr(s){this.i=s.Sb||null,this.h=s.ab||!1}v(Nr,ti),Nr.prototype.g=function(){return new bn(this.i,this.h)};function bn(s,a){ft.call(this),this.H=s,this.o=a,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.A=new Headers,this.h=null,this.F="GET",this.D="",this.g=!1,this.B=this.j=this.l=null,this.v=new AbortController}v(bn,ft),n=bn.prototype,n.open=function(s,a){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.F=s,this.D=a,this.readyState=1,We(this)},n.send=function(s){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");if(this.v.signal.aborted)throw this.abort(),Error("Request was aborted.");this.g=!0;const a={headers:this.A,method:this.F,credentials:this.m,cache:void 0,signal:this.v.signal};s&&(a.body=s),(this.H||u).fetch(new Request(this.D,a)).then(this.Pa.bind(this),this.ga.bind(this))},n.abort=function(){this.response=this.responseText="",this.A=new Headers,this.status=0,this.v.abort(),this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),this.readyState>=1&&this.g&&this.readyState!=4&&(this.g=!1,Qe(this)),this.readyState=0},n.Pa=function(s){if(this.g&&(this.l=s,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=s.headers,this.readyState=2,We(this)),this.g&&(this.readyState=3,We(this),this.g)))if(this.responseType==="arraybuffer")s.arrayBuffer().then(this.Na.bind(this),this.ga.bind(this));else if(typeof u.ReadableStream<"u"&&"body"in s){if(this.j=s.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.B=new TextDecoder;Ri(this)}else s.text().then(this.Oa.bind(this),this.ga.bind(this))};function Ri(s){s.j.read().then(s.Ma.bind(s)).catch(s.ga.bind(s))}n.Ma=function(s){if(this.g){if(this.o&&s.value)this.response.push(s.value);else if(!this.o){var a=s.value?s.value:new Uint8Array(0);(a=this.B.decode(a,{stream:!s.done}))&&(this.response=this.responseText+=a)}s.done?Qe(this):We(this),this.readyState==3&&Ri(this)}},n.Oa=function(s){this.g&&(this.response=this.responseText=s,Qe(this))},n.Na=function(s){this.g&&(this.response=s,Qe(this))},n.ga=function(){this.g&&Qe(this)};function Qe(s){s.readyState=4,s.l=null,s.j=null,s.B=null,We(s)}n.setRequestHeader=function(s,a){this.A.append(s,a)},n.getResponseHeader=function(s){return this.h&&this.h.get(s.toLowerCase())||""},n.getAllResponseHeaders=function(){if(!this.h)return"";const s=[],a=this.h.entries();for(var c=a.next();!c.done;)c=c.value,s.push(c[0]+": "+c[1]),c=a.next();return s.join(`\r
`)};function We(s){s.onreadystatechange&&s.onreadystatechange.call(s)}Object.defineProperty(bn.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(s){this.m=s?"include":"same-origin"}});function Si(s){let a="";return vn(s,function(c,h){a+=h,a+=":",a+=c,a+=`\r
`}),a}function kr(s,a,c){t:{for(h in c){var h=!1;break t}h=!0}h||(c=Si(c),typeof s=="string"?c!=null&&je(c):G(s,a,c))}function Y(s){ft.call(this),this.headers=new Map,this.L=s||null,this.h=!1,this.g=null,this.D="",this.o=0,this.l="",this.j=this.B=this.v=this.A=!1,this.m=null,this.F="",this.H=!1}v(Y,ft);var Yu=/^https?$/i,Xu=["POST","PUT"];n=Y.prototype,n.Fa=function(s){this.H=s},n.ea=function(s,a,c,h){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+s);a=a?a.toUpperCase():"GET",this.D=s,this.l="",this.o=0,this.A=!1,this.h=!0,this.g=this.L?this.L.g():ai.g(),this.g.onreadystatechange=R(d(this.Ca,this));try{this.B=!0,this.g.open(a,String(s),!0),this.B=!1}catch(A){Ci(this,A);return}if(s=c||"",c=new Map(this.headers),h)if(Object.getPrototypeOf(h)===Object.prototype)for(var I in h)c.set(I,h[I]);else if(typeof h.keys=="function"&&typeof h.get=="function")for(const A of h.keys())c.set(A,h.get(A));else throw Error("Unknown input type for opt_headers: "+String(h));h=Array.from(c.keys()).find(A=>A.toLowerCase()=="content-type"),I=u.FormData&&s instanceof u.FormData,!(Array.prototype.indexOf.call(Xu,a,void 0)>=0)||h||I||c.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[A,b]of c)this.g.setRequestHeader(A,b);this.F&&(this.g.responseType=this.F),"withCredentials"in this.g&&this.g.withCredentials!==this.H&&(this.g.withCredentials=this.H);try{this.m&&(clearTimeout(this.m),this.m=null),this.v=!0,this.g.send(s),this.v=!1}catch(A){Ci(this,A)}};function Ci(s,a){s.h=!1,s.g&&(s.j=!0,s.g.abort(),s.j=!1),s.l=a,s.o=5,bi(s),Pn(s)}function bi(s){s.A||(s.A=!0,gt(s,"complete"),gt(s,"error"))}n.abort=function(s){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.o=s||7,gt(this,"complete"),gt(this,"abort"),Pn(this))},n.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),Pn(this,!0)),Y.Z.N.call(this)},n.Ca=function(){this.u||(this.B||this.v||this.j?Pi(this):this.Xa())},n.Xa=function(){Pi(this)};function Pi(s){if(s.h&&typeof o<"u"){if(s.v&&Lt(s)==4)setTimeout(s.Ca.bind(s),0);else if(gt(s,"readystatechange"),Lt(s)==4){s.h=!1;try{const A=s.ca();t:switch(A){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var a=!0;break t;default:a=!1}var c;if(!(c=a)){var h;if(h=A===0){let b=String(s.D).match(yi)[1]||null;!b&&u.self&&u.self.location&&(b=u.self.location.protocol.slice(0,-1)),h=!Yu.test(b?b.toLowerCase():"")}c=h}if(c)gt(s,"complete"),gt(s,"success");else{s.o=6;try{var I=Lt(s)>2?s.g.statusText:""}catch{I=""}s.l=I+" ["+s.ca()+"]",bi(s)}}finally{Pn(s)}}}}function Pn(s,a){if(s.g){s.m&&(clearTimeout(s.m),s.m=null);const c=s.g;s.g=null,a||gt(s,"ready");try{c.onreadystatechange=null}catch{}}}n.isActive=function(){return!!this.g};function Lt(s){return s.g?s.g.readyState:0}n.ca=function(){try{return Lt(this)>2?this.g.status:-1}catch{return-1}},n.la=function(){try{return this.g?this.g.responseText:""}catch{return""}},n.La=function(s){if(this.g){var a=this.g.responseText;return s&&a.indexOf(s)==0&&(a=a.substring(s.length)),Du(a)}};function Vi(s){try{if(!s.g)return null;if("response"in s.g)return s.g.response;switch(s.F){case"":case"text":return s.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in s.g)return s.g.mozResponseArrayBuffer}return null}catch{return null}}function Zu(s){const a={};s=(s.g&&Lt(s)>=2&&s.g.getAllResponseHeaders()||"").split(`\r
`);for(let h=0;h<s.length;h++){if(p(s[h]))continue;var c=Lu(s[h]);const I=c[0];if(c=c[1],typeof c!="string")continue;c=c.trim();const A=a[I]||[];a[I]=A,A.push(c)}Ru(a,function(h){return h.join(", ")})}n.ya=function(){return this.o},n.Ha=function(){return typeof this.l=="string"?this.l:String(this.l)};function Je(s,a,c){return c&&c.internalChannelParams&&c.internalChannelParams[s]||a}function Di(s){this.za=0,this.i=[],this.j=new Be,this.ba=this.na=this.J=this.W=this.g=this.wa=this.G=this.H=this.u=this.U=this.o=null,this.Ya=this.V=0,this.Sa=Je("failFast",!1,s),this.F=this.C=this.v=this.m=this.l=null,this.X=!0,this.xa=this.K=-1,this.Y=this.A=this.D=0,this.Qa=Je("baseRetryDelayMs",5e3,s),this.Za=Je("retryDelaySeedMs",1e4,s),this.Ta=Je("forwardChannelMaxRetries",2,s),this.va=Je("forwardChannelRequestTimeoutMs",2e4,s),this.ma=s&&s.xmlHttpFactory||void 0,this.Ua=s&&s.Rb||void 0,this.Aa=s&&s.useFetchStreams||!1,this.O=void 0,this.L=s&&s.supportsCrossDomainXhr||!1,this.M="",this.h=new di(s&&s.concurrentRequestLimit),this.Ba=new Ju,this.S=s&&s.fastHandshake||!1,this.R=s&&s.encodeInitMessageHeaders||!1,this.S&&this.R&&(this.R=!1),this.Ra=s&&s.Pb||!1,s&&s.ua&&this.j.ua(),s&&s.forceLongPolling&&(this.X=!1),this.aa=!this.S&&this.X&&s&&s.detectBufferingProxy||!1,this.ia=void 0,s&&s.longPollingTimeout&&s.longPollingTimeout>0&&(this.ia=s.longPollingTimeout),this.ta=void 0,this.T=0,this.P=!1,this.ja=this.B=null}n=Di.prototype,n.ka=8,n.I=1,n.connect=function(s,a,c,h){_t(0),this.W=s,this.H=a||{},c&&h!==void 0&&(this.H.OSID=c,this.H.OAID=h),this.F=this.X,this.J=Bi(this,null,this.W),Dn(this)};function Or(s){if(Ni(s),s.I==3){var a=s.V++,c=At(s.J);if(G(c,"SID",s.M),G(c,"RID",a),G(c,"TYPE","terminate"),Ye(s,c),a=new Ot(s,s.j,a),a.M=2,a.A=Cn(At(c)),c=!1,u.navigator&&u.navigator.sendBeacon)try{c=u.navigator.sendBeacon(a.A.toString(),"")}catch{}!c&&u.Image&&(new Image().src=a.A,c=!0),c||(a.g=ji(a.j,null),a.g.ea(a.A)),a.F=Date.now(),Sn(a)}Ui(s)}function Vn(s){s.g&&(Mr(s),s.g.cancel(),s.g=null)}function Ni(s){Vn(s),s.v&&(u.clearTimeout(s.v),s.v=null),Nn(s),s.h.cancel(),s.m&&(typeof s.m=="number"&&u.clearTimeout(s.m),s.m=null)}function Dn(s){if(!mi(s.h)&&!s.m){s.m=!0;var a=s.Ea;lt||m(),ht||(lt(),ht=!0),E.add(a,s),s.D=0}}function tc(s,a){return pi(s.h)>=s.h.j-(s.m?1:0)?!1:s.m?(s.i=a.G.concat(s.i),!0):s.I==1||s.I==2||s.D>=(s.Sa?0:s.Ta)?!1:(s.m=Ue(d(s.Ea,s,a),Fi(s,s.D)),s.D++,!0)}n.Ea=function(s){if(this.m)if(this.m=null,this.I==1){if(!s){this.V=Math.floor(Math.random()*1e5),s=this.V++;const I=new Ot(this,this.j,s);let A=this.o;if(this.U&&(A?(A=zs(A),Gs(A,this.U)):A=this.U),this.u!==null||this.R||(I.J=A,A=null),this.S)t:{for(var a=0,c=0;c<this.i.length;c++){e:{var h=this.i[c];if("__data__"in h.map&&(h=h.map.__data__,typeof h=="string")){h=h.length;break e}h=void 0}if(h===void 0)break;if(a+=h,a>4096){a=c;break t}if(a===4096||c===this.i.length-1){a=c+1;break t}}a=1e3}else a=1e3;a=Oi(this,I,a),c=At(this.J),G(c,"RID",s),G(c,"CVER",22),this.G&&G(c,"X-HTTP-Session-Id",this.G),Ye(this,c),A&&(this.R?a="headers="+je(Si(A))+"&"+a:this.u&&kr(c,this.u,A)),Vr(this.h,I),this.Ra&&G(c,"TYPE","init"),this.S?(G(c,"$req",a),G(c,"SID","null"),I.U=!0,Sr(I,c,null)):Sr(I,c,a),this.I=2}}else this.I==3&&(s?ki(this,s):this.i.length==0||mi(this.h)||ki(this))};function ki(s,a){var c;a?c=a.l:c=s.V++;const h=At(s.J);G(h,"SID",s.M),G(h,"RID",c),G(h,"AID",s.K),Ye(s,h),s.u&&s.o&&kr(h,s.u,s.o),c=new Ot(s,s.j,c,s.D+1),s.u===null&&(c.J=s.o),a&&(s.i=a.G.concat(s.i)),a=Oi(s,c,1e3),c.H=Math.round(s.va*.5)+Math.round(s.va*.5*Math.random()),Vr(s.h,c),Sr(c,h,a)}function Ye(s,a){s.H&&vn(s.H,function(c,h){G(a,h,c)}),s.l&&vn({},function(c,h){G(a,h,c)})}function Oi(s,a,c){c=Math.min(s.i.length,c);const h=s.l?d(s.l.Ka,s.l,s):null;t:{var I=s.i;let F=-1;for(;;){const rt=["count="+c];F==-1?c>0?(F=I[0].g,rt.push("ofs="+F)):F=0:rt.push("ofs="+F);let z=!0;for(let ot=0;ot<c;ot++){var A=I[ot].g;const Rt=I[ot].map;if(A-=F,A<0)F=Math.max(0,I[ot].g-100),z=!1;else try{A="req"+A+"_"||"";try{var b=Rt instanceof Map?Rt:Object.entries(Rt);for(const[se,Ft]of b){let Ut=Ft;l(Ft)&&(Ut=vr(Ft)),rt.push(A+se+"="+encodeURIComponent(Ut))}}catch(se){throw rt.push(A+"type="+encodeURIComponent("_badmap")),se}}catch{h&&h(Rt)}}if(z){b=rt.join("&");break t}}b=void 0}return s=s.i.splice(0,c),a.G=s,b}function xi(s){if(!s.g&&!s.v){s.Y=1;var a=s.Da;lt||m(),ht||(lt(),ht=!0),E.add(a,s),s.A=0}}function xr(s){return s.g||s.v||s.A>=3?!1:(s.Y++,s.v=Ue(d(s.Da,s),Fi(s,s.A)),s.A++,!0)}n.Da=function(){if(this.v=null,Mi(this),this.aa&&!(this.P||this.g==null||this.T<=0)){var s=4*this.T;this.j.info("BP detection timer enabled: "+s),this.B=Ue(d(this.Wa,this),s)}},n.Wa=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.P=!0,_t(10),Vn(this),Mi(this))};function Mr(s){s.B!=null&&(u.clearTimeout(s.B),s.B=null)}function Mi(s){s.g=new Ot(s,s.j,"rpc",s.Y),s.u===null&&(s.g.J=s.o),s.g.P=0;var a=At(s.na);G(a,"RID","rpc"),G(a,"SID",s.M),G(a,"AID",s.K),G(a,"CI",s.F?"0":"1"),!s.F&&s.ia&&G(a,"TO",s.ia),G(a,"TYPE","xmlhttp"),Ye(s,a),s.u&&s.o&&kr(a,s.u,s.o),s.O&&(s.g.H=s.O);var c=s.g;s=s.ba,c.M=1,c.A=Cn(At(a)),c.u=null,c.R=!0,li(c,s)}n.Va=function(){this.C!=null&&(this.C=null,Vn(this),xr(this),_t(19))};function Nn(s){s.C!=null&&(u.clearTimeout(s.C),s.C=null)}function Li(s,a){var c=null;if(s.g==a){Nn(s),Mr(s),s.g=null;var h=2}else if(Pr(s.h,a))c=a.G,gi(s.h,a),h=1;else return;if(s.I!=0){if(a.o)if(h==1){c=a.u?a.u.length:0,a=Date.now()-a.F;var I=s.D;h=An(),gt(h,new ii(h,c)),Dn(s)}else xi(s);else if(I=a.m,I==3||I==0&&a.X>0||!(h==1&&tc(s,a)||h==2&&xr(s)))switch(c&&c.length>0&&(a=s.h,a.i=a.i.concat(c)),I){case 1:re(s,5);break;case 4:re(s,10);break;case 3:re(s,6);break;default:re(s,2)}}}function Fi(s,a){let c=s.Qa+Math.floor(Math.random()*s.Za);return s.isActive()||(c*=2),c*a}function re(s,a){if(s.j.info("Error code "+a),a==2){var c=d(s.bb,s),h=s.Ua;const I=!h;h=new xt(h||"//www.google.com/images/cleardot.gif"),u.location&&u.location.protocol=="http"||$e(h,"https"),Cn(h),I?Qu(h.toString(),c):Wu(h.toString(),c)}else _t(2);s.I=0,s.l&&s.l.pa(a),Ui(s),Ni(s)}n.bb=function(s){s?(this.j.info("Successfully pinged google.com"),_t(2)):(this.j.info("Failed to ping google.com"),_t(1))};function Ui(s){if(s.I=0,s.ja=[],s.l){const a=_i(s.h);(a.length!=0||s.i.length!=0)&&(O(s.ja,a),O(s.ja,s.i),s.h.i.length=0,C(s.i),s.i.length=0),s.l.oa()}}function Bi(s,a,c){var h=c instanceof xt?At(c):new xt(c);if(h.g!="")a&&(h.g=a+"."+h.g),ze(h,h.u);else{var I=u.location;h=I.protocol,a=a?a+"."+I.hostname:I.hostname,I=+I.port;const A=new xt(null);h&&$e(A,h),a&&(A.g=a),I&&ze(A,I),c&&(A.h=c),h=A}return c=s.G,a=s.wa,c&&a&&G(h,c,a),G(h,"VER",s.ka),Ye(s,h),h}function ji(s,a,c){if(a&&!s.L)throw Error("Can't create secondary domain capable XhrIo object.");return a=s.Aa&&!s.ma?new Y(new Nr({ab:c})):new Y(s.ma),a.Fa(s.L),a}n.isActive=function(){return!!this.l&&this.l.isActive(this)};function qi(){}n=qi.prototype,n.ra=function(){},n.qa=function(){},n.pa=function(){},n.oa=function(){},n.isActive=function(){return!0},n.Ka=function(){};function kn(){}kn.prototype.g=function(s,a){return new It(s,a)};function It(s,a){ft.call(this),this.g=new Di(a),this.l=s,this.h=a&&a.messageUrlParams||null,s=a&&a.messageHeaders||null,a&&a.clientProtocolHeaderRequired&&(s?s["X-Client-Protocol"]="webchannel":s={"X-Client-Protocol":"webchannel"}),this.g.o=s,s=a&&a.initMessageHeaders||null,a&&a.messageContentType&&(s?s["X-WebChannel-Content-Type"]=a.messageContentType:s={"X-WebChannel-Content-Type":a.messageContentType}),a&&a.sa&&(s?s["X-WebChannel-Client-Profile"]=a.sa:s={"X-WebChannel-Client-Profile":a.sa}),this.g.U=s,(s=a&&a.Qb)&&!p(s)&&(this.g.u=s),this.A=a&&a.supportsCrossDomainXhr||!1,this.v=a&&a.sendRawJson||!1,(a=a&&a.httpSessionIdParam)&&!p(a)&&(this.g.G=a,s=this.h,s!==null&&a in s&&(s=this.h,a in s&&delete s[a])),this.j=new me(this)}v(It,ft),It.prototype.m=function(){this.g.l=this.j,this.A&&(this.g.L=!0),this.g.connect(this.l,this.h||void 0)},It.prototype.close=function(){Or(this.g)},It.prototype.o=function(s){var a=this.g;if(typeof s=="string"){var c={};c.__data__=s,s=c}else this.v&&(c={},c.__data__=vr(s),s=c);a.i.push(new Bu(a.Ya++,s)),a.I==3&&Dn(a)},It.prototype.N=function(){this.g.l=null,delete this.j,Or(this.g),delete this.g,It.Z.N.call(this)};function $i(s){Ir.call(this),s.__headers__&&(this.headers=s.__headers__,this.statusCode=s.__status__,delete s.__headers__,delete s.__status__);var a=s.__sm__;if(a){t:{for(const c in a){s=c;break t}s=void 0}(this.i=s)&&(s=this.i,a=a!==null&&s in a?a[s]:void 0),this.data=a}else this.data=s}v($i,Ir);function zi(){wr.call(this),this.status=1}v(zi,wr);function me(s){this.g=s}v(me,qi),me.prototype.ra=function(){gt(this.g,"a")},me.prototype.qa=function(s){gt(this.g,new $i(s))},me.prototype.pa=function(s){gt(this.g,new zi)},me.prototype.oa=function(){gt(this.g,"b")},kn.prototype.createWebChannel=kn.prototype.g,It.prototype.send=It.prototype.o,It.prototype.open=It.prototype.m,It.prototype.close=It.prototype.close,Ea=function(){return new kn},ya=function(){return An()},_a=te,ts={jb:0,mb:1,nb:2,Hb:3,Mb:4,Jb:5,Kb:6,Ib:7,Gb:8,Lb:9,PROXY:10,NOPROXY:11,Eb:12,Ab:13,Bb:14,zb:15,Cb:16,Db:17,fb:18,eb:19,gb:20},Rn.NO_ERROR=0,Rn.TIMEOUT=8,Rn.HTTP_ERROR=6,jn=Rn,oi.COMPLETE="complete",ga=oi,ei.EventType=Le,Le.OPEN="a",Le.CLOSE="b",Le.ERROR="c",Le.MESSAGE="d",ft.prototype.listen=ft.prototype.J,Ze=ei,Y.prototype.listenOnce=Y.prototype.K,Y.prototype.getLastError=Y.prototype.Ha,Y.prototype.getLastErrorCode=Y.prototype.ya,Y.prototype.getStatus=Y.prototype.ca,Y.prototype.getResponseJson=Y.prototype.La,Y.prototype.getResponseText=Y.prototype.la,Y.prototype.send=Y.prototype.ea,Y.prototype.setWithCredentials=Y.prototype.Fa,pa=Y}).apply(typeof xn<"u"?xn:typeof self<"u"?self:typeof window<"u"?window:{});/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mt{constructor(t){this.uid=t}isAuthenticated(){return this.uid!=null}toKey(){return this.isAuthenticated()?"uid:"+this.uid:"anonymous-user"}isEqual(t){return t.uid===this.uid}}mt.UNAUTHENTICATED=new mt(null),mt.GOOGLE_CREDENTIALS=new mt("google-credentials-uid"),mt.FIRST_PARTY=new mt("first-party-uid"),mt.MOCK_USER=new mt("mock-user");/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let ke="12.10.0";function ql(n){ke=n}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ce=new ca("@firebase/firestore");function pe(){return ce.logLevel}function V(n,...t){if(ce.logLevel<=j.DEBUG){const e=t.map(ws);ce.debug(`Firestore (${ke}): ${n}`,...e)}}function kt(n,...t){if(ce.logLevel<=j.ERROR){const e=t.map(ws);ce.error(`Firestore (${ke}): ${n}`,...e)}}function le(n,...t){if(ce.logLevel<=j.WARN){const e=t.map(ws);ce.warn(`Firestore (${ke}): ${n}`,...e)}}function ws(n){if(typeof n=="string")return n;try{return function(e){return JSON.stringify(e)}(n)}catch{return n}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function M(n,t,e){let r="Unexpected state";typeof t=="string"?r=t:e=t,Ta(n,r,e)}function Ta(n,t,e){let r=`FIRESTORE (${ke}) INTERNAL ASSERTION FAILED: ${t} (ID: ${n.toString(16)})`;if(e!==void 0)try{r+=" CONTEXT: "+JSON.stringify(e)}catch{r+=" CONTEXT: "+e}throw kt(r),new Error(r)}function Q(n,t,e,r){let i="Unexpected state";typeof e=="string"?i=e:r=e,n||Ta(t,i,r)}function q(n,t){return n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const P={OK:"ok",CANCELLED:"cancelled",UNKNOWN:"unknown",INVALID_ARGUMENT:"invalid-argument",DEADLINE_EXCEEDED:"deadline-exceeded",NOT_FOUND:"not-found",ALREADY_EXISTS:"already-exists",PERMISSION_DENIED:"permission-denied",UNAUTHENTICATED:"unauthenticated",RESOURCE_EXHAUSTED:"resource-exhausted",FAILED_PRECONDITION:"failed-precondition",ABORTED:"aborted",OUT_OF_RANGE:"out-of-range",UNIMPLEMENTED:"unimplemented",INTERNAL:"internal",UNAVAILABLE:"unavailable",DATA_LOSS:"data-loss"};class D extends Ne{constructor(t,e){super(t,e),this.code=t,this.message=e,this.toString=()=>`${this.name}: [code=${this.code}]: ${this.message}`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ae{constructor(){this.promise=new Promise((t,e)=>{this.resolve=t,this.reject=e})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class va{constructor(t,e){this.user=e,this.type="OAuth",this.headers=new Map,this.headers.set("Authorization",`Bearer ${t}`)}}class $l{getToken(){return Promise.resolve(null)}invalidateToken(){}start(t,e){t.enqueueRetryable(()=>e(mt.UNAUTHENTICATED))}shutdown(){}}class zl{constructor(t){this.token=t,this.changeListener=null}getToken(){return Promise.resolve(this.token)}invalidateToken(){}start(t,e){this.changeListener=e,t.enqueueRetryable(()=>e(this.token.user))}shutdown(){this.changeListener=null}}class Hl{constructor(t){this.t=t,this.currentUser=mt.UNAUTHENTICATED,this.i=0,this.forceRefresh=!1,this.auth=null}start(t,e){Q(this.o===void 0,42304);let r=this.i;const i=f=>this.i!==r?(r=this.i,e(f)):Promise.resolve();let o=new ae;this.o=()=>{this.i++,this.currentUser=this.u(),o.resolve(),o=new ae,t.enqueueRetryable(()=>i(this.currentUser))};const u=()=>{const f=o;t.enqueueRetryable(async()=>{await f.promise,await i(this.currentUser)})},l=f=>{V("FirebaseAuthCredentialsProvider","Auth detected"),this.auth=f,this.o&&(this.auth.addAuthTokenListener(this.o),u())};this.t.onInit(f=>l(f)),setTimeout(()=>{if(!this.auth){const f=this.t.getImmediate({optional:!0});f?l(f):(V("FirebaseAuthCredentialsProvider","Auth not yet detected"),o.resolve(),o=new ae)}},0),u()}getToken(){const t=this.i,e=this.forceRefresh;return this.forceRefresh=!1,this.auth?this.auth.getToken(e).then(r=>this.i!==t?(V("FirebaseAuthCredentialsProvider","getToken aborted due to token change."),this.getToken()):r?(Q(typeof r.accessToken=="string",31837,{l:r}),new va(r.accessToken,this.currentUser)):null):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.auth&&this.o&&this.auth.removeAuthTokenListener(this.o),this.o=void 0}u(){const t=this.auth&&this.auth.getUid();return Q(t===null||typeof t=="string",2055,{h:t}),new mt(t)}}class Gl{constructor(t,e,r){this.P=t,this.T=e,this.I=r,this.type="FirstParty",this.user=mt.FIRST_PARTY,this.R=new Map}A(){return this.I?this.I():null}get headers(){this.R.set("X-Goog-AuthUser",this.P);const t=this.A();return t&&this.R.set("Authorization",t),this.T&&this.R.set("X-Goog-Iam-Authorization-Token",this.T),this.R}}class Kl{constructor(t,e,r){this.P=t,this.T=e,this.I=r}getToken(){return Promise.resolve(new Gl(this.P,this.T,this.I))}start(t,e){t.enqueueRetryable(()=>e(mt.FIRST_PARTY))}shutdown(){}invalidateToken(){}}class so{constructor(t){this.value=t,this.type="AppCheck",this.headers=new Map,t&&t.length>0&&this.headers.set("x-firebase-appcheck",this.value)}}class Ql{constructor(t,e){this.V=e,this.forceRefresh=!1,this.appCheck=null,this.m=null,this.p=null,Al(t)&&t.settings.appCheckToken&&(this.p=t.settings.appCheckToken)}start(t,e){Q(this.o===void 0,3512);const r=o=>{o.error!=null&&V("FirebaseAppCheckTokenProvider",`Error getting App Check token; using placeholder token instead. Error: ${o.error.message}`);const u=o.token!==this.m;return this.m=o.token,V("FirebaseAppCheckTokenProvider",`Received ${u?"new":"existing"} token.`),u?e(o.token):Promise.resolve()};this.o=o=>{t.enqueueRetryable(()=>r(o))};const i=o=>{V("FirebaseAppCheckTokenProvider","AppCheck detected"),this.appCheck=o,this.o&&this.appCheck.addTokenListener(this.o)};this.V.onInit(o=>i(o)),setTimeout(()=>{if(!this.appCheck){const o=this.V.getImmediate({optional:!0});o?i(o):V("FirebaseAppCheckTokenProvider","AppCheck not yet detected")}},0)}getToken(){if(this.p)return Promise.resolve(new so(this.p));const t=this.forceRefresh;return this.forceRefresh=!1,this.appCheck?this.appCheck.getToken(t).then(e=>e?(Q(typeof e.token=="string",44558,{tokenResult:e}),this.m=e.token,new so(e.token)):null):Promise.resolve(null)}invalidateToken(){this.forceRefresh=!0}shutdown(){this.appCheck&&this.o&&this.appCheck.removeTokenListener(this.o),this.o=void 0}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Wl(n){const t=typeof self<"u"&&(self.crypto||self.msCrypto),e=new Uint8Array(n);if(t&&typeof t.getRandomValues=="function")t.getRandomValues(e);else for(let r=0;r<n;r++)e[r]=Math.floor(256*Math.random());return e}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ia{static newId(){const t="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",e=62*Math.floor(4.129032258064516);let r="";for(;r.length<20;){const i=Wl(40);for(let o=0;o<i.length;++o)r.length<20&&i[o]<e&&(r+=t.charAt(i[o]%62))}return r}}function U(n,t){return n<t?-1:n>t?1:0}function es(n,t){const e=Math.min(n.length,t.length);for(let r=0;r<e;r++){const i=n.charAt(r),o=t.charAt(r);if(i!==o)return qr(i)===qr(o)?U(i,o):qr(i)?1:-1}return U(n.length,t.length)}const Jl=55296,Yl=57343;function qr(n){const t=n.charCodeAt(0);return t>=Jl&&t<=Yl}function Se(n,t,e){return n.length===t.length&&n.every((r,i)=>e(r,t[i]))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const io="__name__";class St{constructor(t,e,r){e===void 0?e=0:e>t.length&&M(637,{offset:e,range:t.length}),r===void 0?r=t.length-e:r>t.length-e&&M(1746,{length:r,range:t.length-e}),this.segments=t,this.offset=e,this.len=r}get length(){return this.len}isEqual(t){return St.comparator(this,t)===0}child(t){const e=this.segments.slice(this.offset,this.limit());return t instanceof St?t.forEach(r=>{e.push(r)}):e.push(t),this.construct(e)}limit(){return this.offset+this.length}popFirst(t){return t=t===void 0?1:t,this.construct(this.segments,this.offset+t,this.length-t)}popLast(){return this.construct(this.segments,this.offset,this.length-1)}firstSegment(){return this.segments[this.offset]}lastSegment(){return this.get(this.length-1)}get(t){return this.segments[this.offset+t]}isEmpty(){return this.length===0}isPrefixOf(t){if(t.length<this.length)return!1;for(let e=0;e<this.length;e++)if(this.get(e)!==t.get(e))return!1;return!0}isImmediateParentOf(t){if(this.length+1!==t.length)return!1;for(let e=0;e<this.length;e++)if(this.get(e)!==t.get(e))return!1;return!0}forEach(t){for(let e=this.offset,r=this.limit();e<r;e++)t(this.segments[e])}toArray(){return this.segments.slice(this.offset,this.limit())}static comparator(t,e){const r=Math.min(t.length,e.length);for(let i=0;i<r;i++){const o=St.compareSegments(t.get(i),e.get(i));if(o!==0)return o}return U(t.length,e.length)}static compareSegments(t,e){const r=St.isNumericId(t),i=St.isNumericId(e);return r&&!i?-1:!r&&i?1:r&&i?St.extractNumericId(t).compare(St.extractNumericId(e)):es(t,e)}static isNumericId(t){return t.startsWith("__id")&&t.endsWith("__")}static extractNumericId(t){return zt.fromString(t.substring(4,t.length-2))}}class K extends St{construct(t,e,r){return new K(t,e,r)}canonicalString(){return this.toArray().join("/")}toString(){return this.canonicalString()}toUriEncodedString(){return this.toArray().map(encodeURIComponent).join("/")}static fromString(...t){const e=[];for(const r of t){if(r.indexOf("//")>=0)throw new D(P.INVALID_ARGUMENT,`Invalid segment (${r}). Paths must not contain // in them.`);e.push(...r.split("/").filter(i=>i.length>0))}return new K(e)}static emptyPath(){return new K([])}}const Xl=/^[_a-zA-Z][_a-zA-Z0-9]*$/;class yt extends St{construct(t,e,r){return new yt(t,e,r)}static isValidIdentifier(t){return Xl.test(t)}canonicalString(){return this.toArray().map(t=>(t=t.replace(/\\/g,"\\\\").replace(/`/g,"\\`"),yt.isValidIdentifier(t)||(t="`"+t+"`"),t)).join(".")}toString(){return this.canonicalString()}isKeyField(){return this.length===1&&this.get(0)===io}static keyField(){return new yt([io])}static fromServerFormat(t){const e=[];let r="",i=0;const o=()=>{if(r.length===0)throw new D(P.INVALID_ARGUMENT,`Invalid field path (${t}). Paths must not be empty, begin with '.', end with '.', or contain '..'`);e.push(r),r=""};let u=!1;for(;i<t.length;){const l=t[i];if(l==="\\"){if(i+1===t.length)throw new D(P.INVALID_ARGUMENT,"Path has trailing escape character: "+t);const f=t[i+1];if(f!=="\\"&&f!=="."&&f!=="`")throw new D(P.INVALID_ARGUMENT,"Path has invalid escape sequence: "+t);r+=f,i+=2}else l==="`"?(u=!u,i++):l!=="."||u?(r+=l,i++):(o(),i++)}if(o(),u)throw new D(P.INVALID_ARGUMENT,"Unterminated ` in path: "+t);return new yt(e)}static emptyPath(){return new yt([])}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class k{constructor(t){this.path=t}static fromPath(t){return new k(K.fromString(t))}static fromName(t){return new k(K.fromString(t).popFirst(5))}static empty(){return new k(K.emptyPath())}get collectionGroup(){return this.path.popLast().lastSegment()}hasCollectionId(t){return this.path.length>=2&&this.path.get(this.path.length-2)===t}getCollectionGroup(){return this.path.get(this.path.length-2)}getCollectionPath(){return this.path.popLast()}isEqual(t){return t!==null&&K.comparator(this.path,t.path)===0}toString(){return this.path.toString()}static comparator(t,e){return K.comparator(t.path,e.path)}static isDocumentKey(t){return t.length%2==0}static fromSegments(t){return new k(new K(t.slice()))}}function Zl(n,t,e,r){if(t===!0&&r===!0)throw new D(P.INVALID_ARGUMENT,`${n} and ${e} cannot be used together.`)}function oo(n){if(k.isDocumentKey(n))throw new D(P.INVALID_ARGUMENT,`Invalid collection reference. Collection references must have an odd number of segments, but ${n} has ${n.length}.`)}function th(n){return typeof n=="object"&&n!==null&&(Object.getPrototypeOf(n)===Object.prototype||Object.getPrototypeOf(n)===null)}function eh(n){if(n===void 0)return"undefined";if(n===null)return"null";if(typeof n=="string")return n.length>20&&(n=`${n.substring(0,20)}...`),JSON.stringify(n);if(typeof n=="number"||typeof n=="boolean")return""+n;if(typeof n=="object"){if(n instanceof Array)return"an array";{const t=function(r){return r.constructor?r.constructor.name:null}(n);return t?`a custom ${t} object`:"an object"}}return typeof n=="function"?"a function":M(12329,{type:typeof n})}function ns(n,t){if("_delegate"in n&&(n=n._delegate),!(n instanceof t)){if(t.name===n.constructor.name)throw new D(P.INVALID_ARGUMENT,"Type does not match the expected instance. Did you pass a reference from a different Firestore SDK?");{const e=eh(n);throw new D(P.INVALID_ARGUMENT,`Expected type '${t.name}', but it was: ${e}`)}}return n}/**
 * @license
 * Copyright 2025 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function nt(n,t){const e={typeString:n};return t&&(e.value=t),e}function pn(n,t){if(!th(n))throw new D(P.INVALID_ARGUMENT,"JSON must be an object");let e;for(const r in t)if(t[r]){const i=t[r].typeString,o="value"in t[r]?{value:t[r].value}:void 0;if(!(r in n)){e=`JSON missing required field: '${r}'`;break}const u=n[r];if(i&&typeof u!==i){e=`JSON field '${r}' must be a ${i}.`;break}if(o!==void 0&&u!==o.value){e=`Expected '${r}' field to equal '${o.value}'`;break}}if(e)throw new D(P.INVALID_ARGUMENT,e);return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ao=-62135596800,uo=1e6;class et{static now(){return et.fromMillis(Date.now())}static fromDate(t){return et.fromMillis(t.getTime())}static fromMillis(t){const e=Math.floor(t/1e3),r=Math.floor((t-1e3*e)*uo);return new et(e,r)}constructor(t,e){if(this.seconds=t,this.nanoseconds=e,e<0)throw new D(P.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+e);if(e>=1e9)throw new D(P.INVALID_ARGUMENT,"Timestamp nanoseconds out of range: "+e);if(t<ao)throw new D(P.INVALID_ARGUMENT,"Timestamp seconds out of range: "+t);if(t>=253402300800)throw new D(P.INVALID_ARGUMENT,"Timestamp seconds out of range: "+t)}toDate(){return new Date(this.toMillis())}toMillis(){return 1e3*this.seconds+this.nanoseconds/uo}_compareTo(t){return this.seconds===t.seconds?U(this.nanoseconds,t.nanoseconds):U(this.seconds,t.seconds)}isEqual(t){return t.seconds===this.seconds&&t.nanoseconds===this.nanoseconds}toString(){return"Timestamp(seconds="+this.seconds+", nanoseconds="+this.nanoseconds+")"}toJSON(){return{type:et._jsonSchemaVersion,seconds:this.seconds,nanoseconds:this.nanoseconds}}static fromJSON(t){if(pn(t,et._jsonSchema))return new et(t.seconds,t.nanoseconds)}valueOf(){const t=this.seconds-ao;return String(t).padStart(12,"0")+"."+String(this.nanoseconds).padStart(9,"0")}}et._jsonSchemaVersion="firestore/timestamp/1.0",et._jsonSchema={type:nt("string",et._jsonSchemaVersion),seconds:nt("number"),nanoseconds:nt("number")};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class x{static fromTimestamp(t){return new x(t)}static min(){return new x(new et(0,0))}static max(){return new x(new et(253402300799,999999999))}constructor(t){this.timestamp=t}compareTo(t){return this.timestamp._compareTo(t.timestamp)}isEqual(t){return this.timestamp.isEqual(t.timestamp)}toMicroseconds(){return 1e6*this.timestamp.seconds+this.timestamp.nanoseconds/1e3}toString(){return"SnapshotVersion("+this.timestamp.toString()+")"}toTimestamp(){return this.timestamp}}/**
 * @license
 * Copyright 2021 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const hn=-1;function nh(n,t){const e=n.toTimestamp().seconds,r=n.toTimestamp().nanoseconds+1,i=x.fromTimestamp(r===1e9?new et(e+1,0):new et(e,r));return new Kt(i,k.empty(),t)}function rh(n){return new Kt(n.readTime,n.key,hn)}class Kt{constructor(t,e,r){this.readTime=t,this.documentKey=e,this.largestBatchId=r}static min(){return new Kt(x.min(),k.empty(),hn)}static max(){return new Kt(x.max(),k.empty(),hn)}}function sh(n,t){let e=n.readTime.compareTo(t.readTime);return e!==0?e:(e=k.comparator(n.documentKey,t.documentKey),e!==0?e:U(n.largestBatchId,t.largestBatchId))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ih="The current tab is not in the required state to perform this operation. It might be necessary to refresh the browser tab.";class oh{constructor(){this.onCommittedListeners=[]}addOnCommittedListener(t){this.onCommittedListeners.push(t)}raiseOnCommittedEvent(){this.onCommittedListeners.forEach(t=>t())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function nr(n){if(n.code!==P.FAILED_PRECONDITION||n.message!==ih)throw n;V("LocalStore","Unexpectedly lost primary lease")}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class S{constructor(t){this.nextCallback=null,this.catchCallback=null,this.result=void 0,this.error=void 0,this.isDone=!1,this.callbackAttached=!1,t(e=>{this.isDone=!0,this.result=e,this.nextCallback&&this.nextCallback(e)},e=>{this.isDone=!0,this.error=e,this.catchCallback&&this.catchCallback(e)})}catch(t){return this.next(void 0,t)}next(t,e){return this.callbackAttached&&M(59440),this.callbackAttached=!0,this.isDone?this.error?this.wrapFailure(e,this.error):this.wrapSuccess(t,this.result):new S((r,i)=>{this.nextCallback=o=>{this.wrapSuccess(t,o).next(r,i)},this.catchCallback=o=>{this.wrapFailure(e,o).next(r,i)}})}toPromise(){return new Promise((t,e)=>{this.next(t,e)})}wrapUserFunction(t){try{const e=t();return e instanceof S?e:S.resolve(e)}catch(e){return S.reject(e)}}wrapSuccess(t,e){return t?this.wrapUserFunction(()=>t(e)):S.resolve(e)}wrapFailure(t,e){return t?this.wrapUserFunction(()=>t(e)):S.reject(e)}static resolve(t){return new S((e,r)=>{e(t)})}static reject(t){return new S((e,r)=>{r(t)})}static waitFor(t){return new S((e,r)=>{let i=0,o=0,u=!1;t.forEach(l=>{++i,l.next(()=>{++o,u&&o===i&&e()},f=>r(f))}),u=!0,o===i&&e()})}static or(t){let e=S.resolve(!1);for(const r of t)e=e.next(i=>i?S.resolve(i):r());return e}static forEach(t,e){const r=[];return t.forEach((i,o)=>{r.push(e.call(this,i,o))}),this.waitFor(r)}static mapArray(t,e){return new S((r,i)=>{const o=t.length,u=new Array(o);let l=0;for(let f=0;f<o;f++){const d=f;e(t[d]).next(_=>{u[d]=_,++l,l===o&&r(u)},_=>i(_))}})}static doWhile(t,e){return new S((r,i)=>{const o=()=>{t()===!0?e().next(()=>{o()},i):r()};o()})}}function ah(n){const t=n.match(/Android ([\d.]+)/i),e=t?t[1].split(".").slice(0,2).join("."):"-1";return Number(e)}function Oe(n){return n.name==="IndexedDbTransactionError"}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class rr{constructor(t,e){this.previousValue=t,e&&(e.sequenceNumberHandler=r=>this.ae(r),this.ue=r=>e.writeSequenceNumber(r))}ae(t){return this.previousValue=Math.max(t,this.previousValue),this.previousValue}next(){const t=++this.previousValue;return this.ue&&this.ue(t),t}}rr.ce=-1;/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const uh=-1;function sr(n){return n==null}function rs(n){return n===0&&1/n==-1/0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const wa="";function ch(n){let t="";for(let e=0;e<n.length;e++)t.length>0&&(t=co(t)),t=lh(n.get(e),t);return co(t)}function lh(n,t){let e=t;const r=n.length;for(let i=0;i<r;i++){const o=n.charAt(i);switch(o){case"\0":e+="";break;case wa:e+="";break;default:e+=o}}return e}function co(n){return n+wa+""}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function lo(n){let t=0;for(const e in n)Object.prototype.hasOwnProperty.call(n,e)&&t++;return t}function gn(n,t){for(const e in n)Object.prototype.hasOwnProperty.call(n,e)&&t(e,n[e])}function hh(n){for(const t in n)if(Object.prototype.hasOwnProperty.call(n,t))return!1;return!0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Z{constructor(t,e){this.comparator=t,this.root=e||ut.EMPTY}insert(t,e){return new Z(this.comparator,this.root.insert(t,e,this.comparator).copy(null,null,ut.BLACK,null,null))}remove(t){return new Z(this.comparator,this.root.remove(t,this.comparator).copy(null,null,ut.BLACK,null,null))}get(t){let e=this.root;for(;!e.isEmpty();){const r=this.comparator(t,e.key);if(r===0)return e.value;r<0?e=e.left:r>0&&(e=e.right)}return null}indexOf(t){let e=0,r=this.root;for(;!r.isEmpty();){const i=this.comparator(t,r.key);if(i===0)return e+r.left.size;i<0?r=r.left:(e+=r.left.size+1,r=r.right)}return-1}isEmpty(){return this.root.isEmpty()}get size(){return this.root.size}minKey(){return this.root.minKey()}maxKey(){return this.root.maxKey()}inorderTraversal(t){return this.root.inorderTraversal(t)}forEach(t){this.inorderTraversal((e,r)=>(t(e,r),!1))}toString(){const t=[];return this.inorderTraversal((e,r)=>(t.push(`${e}:${r}`),!1)),`{${t.join(", ")}}`}reverseTraversal(t){return this.root.reverseTraversal(t)}getIterator(){return new Mn(this.root,null,this.comparator,!1)}getIteratorFrom(t){return new Mn(this.root,t,this.comparator,!1)}getReverseIterator(){return new Mn(this.root,null,this.comparator,!0)}getReverseIteratorFrom(t){return new Mn(this.root,t,this.comparator,!0)}}class Mn{constructor(t,e,r,i){this.isReverse=i,this.nodeStack=[];let o=1;for(;!t.isEmpty();)if(o=e?r(t.key,e):1,e&&i&&(o*=-1),o<0)t=this.isReverse?t.left:t.right;else{if(o===0){this.nodeStack.push(t);break}this.nodeStack.push(t),t=this.isReverse?t.right:t.left}}getNext(){let t=this.nodeStack.pop();const e={key:t.key,value:t.value};if(this.isReverse)for(t=t.left;!t.isEmpty();)this.nodeStack.push(t),t=t.right;else for(t=t.right;!t.isEmpty();)this.nodeStack.push(t),t=t.left;return e}hasNext(){return this.nodeStack.length>0}peek(){if(this.nodeStack.length===0)return null;const t=this.nodeStack[this.nodeStack.length-1];return{key:t.key,value:t.value}}}class ut{constructor(t,e,r,i,o){this.key=t,this.value=e,this.color=r??ut.RED,this.left=i??ut.EMPTY,this.right=o??ut.EMPTY,this.size=this.left.size+1+this.right.size}copy(t,e,r,i,o){return new ut(t??this.key,e??this.value,r??this.color,i??this.left,o??this.right)}isEmpty(){return!1}inorderTraversal(t){return this.left.inorderTraversal(t)||t(this.key,this.value)||this.right.inorderTraversal(t)}reverseTraversal(t){return this.right.reverseTraversal(t)||t(this.key,this.value)||this.left.reverseTraversal(t)}min(){return this.left.isEmpty()?this:this.left.min()}minKey(){return this.min().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(t,e,r){let i=this;const o=r(t,i.key);return i=o<0?i.copy(null,null,null,i.left.insert(t,e,r),null):o===0?i.copy(null,e,null,null,null):i.copy(null,null,null,null,i.right.insert(t,e,r)),i.fixUp()}removeMin(){if(this.left.isEmpty())return ut.EMPTY;let t=this;return t.left.isRed()||t.left.left.isRed()||(t=t.moveRedLeft()),t=t.copy(null,null,null,t.left.removeMin(),null),t.fixUp()}remove(t,e){let r,i=this;if(e(t,i.key)<0)i.left.isEmpty()||i.left.isRed()||i.left.left.isRed()||(i=i.moveRedLeft()),i=i.copy(null,null,null,i.left.remove(t,e),null);else{if(i.left.isRed()&&(i=i.rotateRight()),i.right.isEmpty()||i.right.isRed()||i.right.left.isRed()||(i=i.moveRedRight()),e(t,i.key)===0){if(i.right.isEmpty())return ut.EMPTY;r=i.right.min(),i=i.copy(r.key,r.value,null,null,i.right.removeMin())}i=i.copy(null,null,null,null,i.right.remove(t,e))}return i.fixUp()}isRed(){return this.color}fixUp(){let t=this;return t.right.isRed()&&!t.left.isRed()&&(t=t.rotateLeft()),t.left.isRed()&&t.left.left.isRed()&&(t=t.rotateRight()),t.left.isRed()&&t.right.isRed()&&(t=t.colorFlip()),t}moveRedLeft(){let t=this.colorFlip();return t.right.left.isRed()&&(t=t.copy(null,null,null,null,t.right.rotateRight()),t=t.rotateLeft(),t=t.colorFlip()),t}moveRedRight(){let t=this.colorFlip();return t.left.left.isRed()&&(t=t.rotateRight(),t=t.colorFlip()),t}rotateLeft(){const t=this.copy(null,null,ut.RED,null,this.right.left);return this.right.copy(null,null,this.color,t,null)}rotateRight(){const t=this.copy(null,null,ut.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,t)}colorFlip(){const t=this.left.copy(null,null,!this.left.color,null,null),e=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,t,e)}checkMaxDepth(){const t=this.check();return Math.pow(2,t)<=this.size+1}check(){if(this.isRed()&&this.left.isRed())throw M(43730,{key:this.key,value:this.value});if(this.right.isRed())throw M(14113,{key:this.key,value:this.value});const t=this.left.check();if(t!==this.right.check())throw M(27949);return t+(this.isRed()?0:1)}}ut.EMPTY=null,ut.RED=!0,ut.BLACK=!1;ut.EMPTY=new class{constructor(){this.size=0}get key(){throw M(57766)}get value(){throw M(16141)}get color(){throw M(16727)}get left(){throw M(29726)}get right(){throw M(36894)}copy(t,e,r,i,o){return this}insert(t,e,r){return new ut(t,e)}remove(t,e){return this}isEmpty(){return!0}inorderTraversal(t){return!1}reverseTraversal(t){return!1}minKey(){return null}maxKey(){return null}isRed(){return!1}checkMaxDepth(){return!0}check(){return 0}};/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class it{constructor(t){this.comparator=t,this.data=new Z(this.comparator)}has(t){return this.data.get(t)!==null}first(){return this.data.minKey()}last(){return this.data.maxKey()}get size(){return this.data.size}indexOf(t){return this.data.indexOf(t)}forEach(t){this.data.inorderTraversal((e,r)=>(t(e),!1))}forEachInRange(t,e){const r=this.data.getIteratorFrom(t[0]);for(;r.hasNext();){const i=r.getNext();if(this.comparator(i.key,t[1])>=0)return;e(i.key)}}forEachWhile(t,e){let r;for(r=e!==void 0?this.data.getIteratorFrom(e):this.data.getIterator();r.hasNext();)if(!t(r.getNext().key))return}firstAfterOrEqual(t){const e=this.data.getIteratorFrom(t);return e.hasNext()?e.getNext().key:null}getIterator(){return new ho(this.data.getIterator())}getIteratorFrom(t){return new ho(this.data.getIteratorFrom(t))}add(t){return this.copy(this.data.remove(t).insert(t,!0))}delete(t){return this.has(t)?this.copy(this.data.remove(t)):this}isEmpty(){return this.data.isEmpty()}unionWith(t){let e=this;return e.size<t.size&&(e=t,t=this),t.forEach(r=>{e=e.add(r)}),e}isEqual(t){if(!(t instanceof it)||this.size!==t.size)return!1;const e=this.data.getIterator(),r=t.data.getIterator();for(;e.hasNext();){const i=e.getNext().key,o=r.getNext().key;if(this.comparator(i,o)!==0)return!1}return!0}toArray(){const t=[];return this.forEach(e=>{t.push(e)}),t}toString(){const t=[];return this.forEach(e=>t.push(e)),"SortedSet("+t.toString()+")"}copy(t){const e=new it(this.comparator);return e.data=t,e}}class ho{constructor(t){this.iter=t}getNext(){return this.iter.getNext().key}hasNext(){return this.iter.hasNext()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Bt{constructor(t){this.fields=t,t.sort(yt.comparator)}static empty(){return new Bt([])}unionWith(t){let e=new it(yt.comparator);for(const r of this.fields)e=e.add(r);for(const r of t)e=e.add(r);return new Bt(e.toArray())}covers(t){for(const e of this.fields)if(e.isPrefixOf(t))return!0;return!1}isEqual(t){return Se(this.fields,t.fields,(e,r)=>e.isEqual(r))}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Aa extends Error{constructor(){super(...arguments),this.name="Base64DecodeError"}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ct{constructor(t){this.binaryString=t}static fromBase64String(t){const e=function(i){try{return atob(i)}catch(o){throw typeof DOMException<"u"&&o instanceof DOMException?new Aa("Invalid base64 string: "+o):o}}(t);return new ct(e)}static fromUint8Array(t){const e=function(i){let o="";for(let u=0;u<i.length;++u)o+=String.fromCharCode(i[u]);return o}(t);return new ct(e)}[Symbol.iterator](){let t=0;return{next:()=>t<this.binaryString.length?{value:this.binaryString.charCodeAt(t++),done:!1}:{value:void 0,done:!0}}}toBase64(){return function(e){return btoa(e)}(this.binaryString)}toUint8Array(){return function(e){const r=new Uint8Array(e.length);for(let i=0;i<e.length;i++)r[i]=e.charCodeAt(i);return r}(this.binaryString)}approximateByteSize(){return 2*this.binaryString.length}compareTo(t){return U(this.binaryString,t.binaryString)}isEqual(t){return this.binaryString===t.binaryString}}ct.EMPTY_BYTE_STRING=new ct("");const fh=new RegExp(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.(\d+))?Z$/);function Qt(n){if(Q(!!n,39018),typeof n=="string"){let t=0;const e=fh.exec(n);if(Q(!!e,46558,{timestamp:n}),e[1]){let i=e[1];i=(i+"000000000").substr(0,9),t=Number(i)}const r=new Date(n);return{seconds:Math.floor(r.getTime()/1e3),nanos:t}}return{seconds:X(n.seconds),nanos:X(n.nanos)}}function X(n){return typeof n=="number"?n:typeof n=="string"?Number(n):0}function Wt(n){return typeof n=="string"?ct.fromBase64String(n):ct.fromUint8Array(n)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ra="server_timestamp",Sa="__type__",Ca="__previous_value__",ba="__local_write_time__";function As(n){var e,r;return((r=(((e=n==null?void 0:n.mapValue)==null?void 0:e.fields)||{})[Sa])==null?void 0:r.stringValue)===Ra}function ir(n){const t=n.mapValue.fields[Ca];return As(t)?ir(t):t}function fn(n){const t=Qt(n.mapValue.fields[ba].timestampValue);return new et(t.seconds,t.nanos)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dh{constructor(t,e,r,i,o,u,l,f,d,_,v){this.databaseId=t,this.appId=e,this.persistenceKey=r,this.host=i,this.ssl=o,this.forceLongPolling=u,this.autoDetectLongPolling=l,this.longPollingOptions=f,this.useFetchStreams=d,this.isUsingEmulator=_,this.apiKey=v}}const Wn="(default)";class dn{constructor(t,e){this.projectId=t,this.database=e||Wn}static empty(){return new dn("","")}get isDefaultDatabase(){return this.database===Wn}isEqual(t){return t instanceof dn&&t.projectId===this.projectId&&t.database===this.database}}function mh(n,t){if(!Object.prototype.hasOwnProperty.apply(n.options,["projectId"]))throw new D(P.INVALID_ARGUMENT,'"projectId" not provided in firebase.initializeApp.');return new dn(n.options.projectId,t)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ph="__type__",gh="__max__",Ln={mapValue:{}},_h="__vector__",ss="value";function Jt(n){return"nullValue"in n?0:"booleanValue"in n?1:"integerValue"in n||"doubleValue"in n?2:"timestampValue"in n?3:"stringValue"in n?5:"bytesValue"in n?6:"referenceValue"in n?7:"geoPointValue"in n?8:"arrayValue"in n?9:"mapValue"in n?As(n)?4:Eh(n)?9007199254740991:yh(n)?10:11:M(28295,{value:n})}function Vt(n,t){if(n===t)return!0;const e=Jt(n);if(e!==Jt(t))return!1;switch(e){case 0:case 9007199254740991:return!0;case 1:return n.booleanValue===t.booleanValue;case 4:return fn(n).isEqual(fn(t));case 3:return function(i,o){if(typeof i.timestampValue=="string"&&typeof o.timestampValue=="string"&&i.timestampValue.length===o.timestampValue.length)return i.timestampValue===o.timestampValue;const u=Qt(i.timestampValue),l=Qt(o.timestampValue);return u.seconds===l.seconds&&u.nanos===l.nanos}(n,t);case 5:return n.stringValue===t.stringValue;case 6:return function(i,o){return Wt(i.bytesValue).isEqual(Wt(o.bytesValue))}(n,t);case 7:return n.referenceValue===t.referenceValue;case 8:return function(i,o){return X(i.geoPointValue.latitude)===X(o.geoPointValue.latitude)&&X(i.geoPointValue.longitude)===X(o.geoPointValue.longitude)}(n,t);case 2:return function(i,o){if("integerValue"in i&&"integerValue"in o)return X(i.integerValue)===X(o.integerValue);if("doubleValue"in i&&"doubleValue"in o){const u=X(i.doubleValue),l=X(o.doubleValue);return u===l?rs(u)===rs(l):isNaN(u)&&isNaN(l)}return!1}(n,t);case 9:return Se(n.arrayValue.values||[],t.arrayValue.values||[],Vt);case 10:case 11:return function(i,o){const u=i.mapValue.fields||{},l=o.mapValue.fields||{};if(lo(u)!==lo(l))return!1;for(const f in u)if(u.hasOwnProperty(f)&&(l[f]===void 0||!Vt(u[f],l[f])))return!1;return!0}(n,t);default:return M(52216,{left:n})}}function mn(n,t){return(n.values||[]).find(e=>Vt(e,t))!==void 0}function Ce(n,t){if(n===t)return 0;const e=Jt(n),r=Jt(t);if(e!==r)return U(e,r);switch(e){case 0:case 9007199254740991:return 0;case 1:return U(n.booleanValue,t.booleanValue);case 2:return function(o,u){const l=X(o.integerValue||o.doubleValue),f=X(u.integerValue||u.doubleValue);return l<f?-1:l>f?1:l===f?0:isNaN(l)?isNaN(f)?0:-1:1}(n,t);case 3:return fo(n.timestampValue,t.timestampValue);case 4:return fo(fn(n),fn(t));case 5:return es(n.stringValue,t.stringValue);case 6:return function(o,u){const l=Wt(o),f=Wt(u);return l.compareTo(f)}(n.bytesValue,t.bytesValue);case 7:return function(o,u){const l=o.split("/"),f=u.split("/");for(let d=0;d<l.length&&d<f.length;d++){const _=U(l[d],f[d]);if(_!==0)return _}return U(l.length,f.length)}(n.referenceValue,t.referenceValue);case 8:return function(o,u){const l=U(X(o.latitude),X(u.latitude));return l!==0?l:U(X(o.longitude),X(u.longitude))}(n.geoPointValue,t.geoPointValue);case 9:return mo(n.arrayValue,t.arrayValue);case 10:return function(o,u){var R,C,O,L;const l=o.fields||{},f=u.fields||{},d=(R=l[ss])==null?void 0:R.arrayValue,_=(C=f[ss])==null?void 0:C.arrayValue,v=U(((O=d==null?void 0:d.values)==null?void 0:O.length)||0,((L=_==null?void 0:_.values)==null?void 0:L.length)||0);return v!==0?v:mo(d,_)}(n.mapValue,t.mapValue);case 11:return function(o,u){if(o===Ln.mapValue&&u===Ln.mapValue)return 0;if(o===Ln.mapValue)return 1;if(u===Ln.mapValue)return-1;const l=o.fields||{},f=Object.keys(l),d=u.fields||{},_=Object.keys(d);f.sort(),_.sort();for(let v=0;v<f.length&&v<_.length;++v){const R=es(f[v],_[v]);if(R!==0)return R;const C=Ce(l[f[v]],d[_[v]]);if(C!==0)return C}return U(f.length,_.length)}(n.mapValue,t.mapValue);default:throw M(23264,{he:e})}}function fo(n,t){if(typeof n=="string"&&typeof t=="string"&&n.length===t.length)return U(n,t);const e=Qt(n),r=Qt(t),i=U(e.seconds,r.seconds);return i!==0?i:U(e.nanos,r.nanos)}function mo(n,t){const e=n.values||[],r=t.values||[];for(let i=0;i<e.length&&i<r.length;++i){const o=Ce(e[i],r[i]);if(o)return o}return U(e.length,r.length)}function be(n){return is(n)}function is(n){return"nullValue"in n?"null":"booleanValue"in n?""+n.booleanValue:"integerValue"in n?""+n.integerValue:"doubleValue"in n?""+n.doubleValue:"timestampValue"in n?function(e){const r=Qt(e);return`time(${r.seconds},${r.nanos})`}(n.timestampValue):"stringValue"in n?n.stringValue:"bytesValue"in n?function(e){return Wt(e).toBase64()}(n.bytesValue):"referenceValue"in n?function(e){return k.fromName(e).toString()}(n.referenceValue):"geoPointValue"in n?function(e){return`geo(${e.latitude},${e.longitude})`}(n.geoPointValue):"arrayValue"in n?function(e){let r="[",i=!0;for(const o of e.values||[])i?i=!1:r+=",",r+=is(o);return r+"]"}(n.arrayValue):"mapValue"in n?function(e){const r=Object.keys(e.fields||{}).sort();let i="{",o=!0;for(const u of r)o?o=!1:i+=",",i+=`${u}:${is(e.fields[u])}`;return i+"}"}(n.mapValue):M(61005,{value:n})}function qn(n){switch(Jt(n)){case 0:case 1:return 4;case 2:return 8;case 3:case 8:return 16;case 4:const t=ir(n);return t?16+qn(t):16;case 5:return 2*n.stringValue.length;case 6:return Wt(n.bytesValue).approximateByteSize();case 7:return n.referenceValue.length;case 9:return function(r){return(r.values||[]).reduce((i,o)=>i+qn(o),0)}(n.arrayValue);case 10:case 11:return function(r){let i=0;return gn(r.fields,(o,u)=>{i+=o.length+qn(u)}),i}(n.mapValue);default:throw M(13486,{value:n})}}function os(n){return!!n&&"integerValue"in n}function Rs(n){return!!n&&"arrayValue"in n}function po(n){return!!n&&"nullValue"in n}function go(n){return!!n&&"doubleValue"in n&&isNaN(Number(n.doubleValue))}function $r(n){return!!n&&"mapValue"in n}function yh(n){var e,r;return((r=(((e=n==null?void 0:n.mapValue)==null?void 0:e.fields)||{})[ph])==null?void 0:r.stringValue)===_h}function rn(n){if(n.geoPointValue)return{geoPointValue:{...n.geoPointValue}};if(n.timestampValue&&typeof n.timestampValue=="object")return{timestampValue:{...n.timestampValue}};if(n.mapValue){const t={mapValue:{fields:{}}};return gn(n.mapValue.fields,(e,r)=>t.mapValue.fields[e]=rn(r)),t}if(n.arrayValue){const t={arrayValue:{values:[]}};for(let e=0;e<(n.arrayValue.values||[]).length;++e)t.arrayValue.values[e]=rn(n.arrayValue.values[e]);return t}return{...n}}function Eh(n){return(((n.mapValue||{}).fields||{}).__type__||{}).stringValue===gh}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ct{constructor(t){this.value=t}static empty(){return new Ct({mapValue:{}})}field(t){if(t.isEmpty())return this.value;{let e=this.value;for(let r=0;r<t.length-1;++r)if(e=(e.mapValue.fields||{})[t.get(r)],!$r(e))return null;return e=(e.mapValue.fields||{})[t.lastSegment()],e||null}}set(t,e){this.getFieldsMap(t.popLast())[t.lastSegment()]=rn(e)}setAll(t){let e=yt.emptyPath(),r={},i=[];t.forEach((u,l)=>{if(!e.isImmediateParentOf(l)){const f=this.getFieldsMap(e);this.applyChanges(f,r,i),r={},i=[],e=l.popLast()}u?r[l.lastSegment()]=rn(u):i.push(l.lastSegment())});const o=this.getFieldsMap(e);this.applyChanges(o,r,i)}delete(t){const e=this.field(t.popLast());$r(e)&&e.mapValue.fields&&delete e.mapValue.fields[t.lastSegment()]}isEqual(t){return Vt(this.value,t.value)}getFieldsMap(t){let e=this.value;e.mapValue.fields||(e.mapValue={fields:{}});for(let r=0;r<t.length;++r){let i=e.mapValue.fields[t.get(r)];$r(i)&&i.mapValue.fields||(i={mapValue:{fields:{}}},e.mapValue.fields[t.get(r)]=i),e=i}return e.mapValue.fields}applyChanges(t,e,r){gn(e,(i,o)=>t[i]=o);for(const i of r)delete t[i]}clone(){return new Ct(rn(this.value))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class pt{constructor(t,e,r,i,o,u,l){this.key=t,this.documentType=e,this.version=r,this.readTime=i,this.createTime=o,this.data=u,this.documentState=l}static newInvalidDocument(t){return new pt(t,0,x.min(),x.min(),x.min(),Ct.empty(),0)}static newFoundDocument(t,e,r,i){return new pt(t,1,e,x.min(),r,i,0)}static newNoDocument(t,e){return new pt(t,2,e,x.min(),x.min(),Ct.empty(),0)}static newUnknownDocument(t,e){return new pt(t,3,e,x.min(),x.min(),Ct.empty(),2)}convertToFoundDocument(t,e){return!this.createTime.isEqual(x.min())||this.documentType!==2&&this.documentType!==0||(this.createTime=t),this.version=t,this.documentType=1,this.data=e,this.documentState=0,this}convertToNoDocument(t){return this.version=t,this.documentType=2,this.data=Ct.empty(),this.documentState=0,this}convertToUnknownDocument(t){return this.version=t,this.documentType=3,this.data=Ct.empty(),this.documentState=2,this}setHasCommittedMutations(){return this.documentState=2,this}setHasLocalMutations(){return this.documentState=1,this.version=x.min(),this}setReadTime(t){return this.readTime=t,this}get hasLocalMutations(){return this.documentState===1}get hasCommittedMutations(){return this.documentState===2}get hasPendingWrites(){return this.hasLocalMutations||this.hasCommittedMutations}isValidDocument(){return this.documentType!==0}isFoundDocument(){return this.documentType===1}isNoDocument(){return this.documentType===2}isUnknownDocument(){return this.documentType===3}isEqual(t){return t instanceof pt&&this.key.isEqual(t.key)&&this.version.isEqual(t.version)&&this.documentType===t.documentType&&this.documentState===t.documentState&&this.data.isEqual(t.data)}mutableCopy(){return new pt(this.key,this.documentType,this.version,this.readTime,this.createTime,this.data.clone(),this.documentState)}toString(){return`Document(${this.key}, ${this.version}, ${JSON.stringify(this.data.value)}, {createTime: ${this.createTime}}), {documentType: ${this.documentType}}), {documentState: ${this.documentState}})`}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jn{constructor(t,e){this.position=t,this.inclusive=e}}function _o(n,t,e){let r=0;for(let i=0;i<n.position.length;i++){const o=t[i],u=n.position[i];if(o.field.isKeyField()?r=k.comparator(k.fromName(u.referenceValue),e.key):r=Ce(u,e.data.field(o.field)),o.dir==="desc"&&(r*=-1),r!==0)break}return r}function yo(n,t){if(n===null)return t===null;if(t===null||n.inclusive!==t.inclusive||n.position.length!==t.position.length)return!1;for(let e=0;e<n.position.length;e++)if(!Vt(n.position[e],t.position[e]))return!1;return!0}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yn{constructor(t,e="asc"){this.field=t,this.dir=e}}function Th(n,t){return n.dir===t.dir&&n.field.isEqual(t.field)}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pa{}class st extends Pa{constructor(t,e,r){super(),this.field=t,this.op=e,this.value=r}static create(t,e,r){return t.isKeyField()?e==="in"||e==="not-in"?this.createKeyFieldInFilter(t,e,r):new Ih(t,e,r):e==="array-contains"?new Rh(t,r):e==="in"?new Sh(t,r):e==="not-in"?new Ch(t,r):e==="array-contains-any"?new bh(t,r):new st(t,e,r)}static createKeyFieldInFilter(t,e,r){return e==="in"?new wh(t,r):new Ah(t,r)}matches(t){const e=t.data.field(this.field);return this.op==="!="?e!==null&&e.nullValue===void 0&&this.matchesComparison(Ce(e,this.value)):e!==null&&Jt(this.value)===Jt(e)&&this.matchesComparison(Ce(e,this.value))}matchesComparison(t){switch(this.op){case"<":return t<0;case"<=":return t<=0;case"==":return t===0;case"!=":return t!==0;case">":return t>0;case">=":return t>=0;default:return M(47266,{operator:this.op})}}isInequality(){return["<","<=",">",">=","!=","not-in"].indexOf(this.op)>=0}getFlattenedFilters(){return[this]}getFilters(){return[this]}}class Dt extends Pa{constructor(t,e){super(),this.filters=t,this.op=e,this.Pe=null}static create(t,e){return new Dt(t,e)}matches(t){return Va(this)?this.filters.find(e=>!e.matches(t))===void 0:this.filters.find(e=>e.matches(t))!==void 0}getFlattenedFilters(){return this.Pe!==null||(this.Pe=this.filters.reduce((t,e)=>t.concat(e.getFlattenedFilters()),[])),this.Pe}getFilters(){return Object.assign([],this.filters)}}function Va(n){return n.op==="and"}function Da(n){return vh(n)&&Va(n)}function vh(n){for(const t of n.filters)if(t instanceof Dt)return!1;return!0}function as(n){if(n instanceof st)return n.field.canonicalString()+n.op.toString()+be(n.value);if(Da(n))return n.filters.map(t=>as(t)).join(",");{const t=n.filters.map(e=>as(e)).join(",");return`${n.op}(${t})`}}function Na(n,t){return n instanceof st?function(r,i){return i instanceof st&&r.op===i.op&&r.field.isEqual(i.field)&&Vt(r.value,i.value)}(n,t):n instanceof Dt?function(r,i){return i instanceof Dt&&r.op===i.op&&r.filters.length===i.filters.length?r.filters.reduce((o,u,l)=>o&&Na(u,i.filters[l]),!0):!1}(n,t):void M(19439)}function ka(n){return n instanceof st?function(e){return`${e.field.canonicalString()} ${e.op} ${be(e.value)}`}(n):n instanceof Dt?function(e){return e.op.toString()+" {"+e.getFilters().map(ka).join(" ,")+"}"}(n):"Filter"}class Ih extends st{constructor(t,e,r){super(t,e,r),this.key=k.fromName(r.referenceValue)}matches(t){const e=k.comparator(t.key,this.key);return this.matchesComparison(e)}}class wh extends st{constructor(t,e){super(t,"in",e),this.keys=Oa("in",e)}matches(t){return this.keys.some(e=>e.isEqual(t.key))}}class Ah extends st{constructor(t,e){super(t,"not-in",e),this.keys=Oa("not-in",e)}matches(t){return!this.keys.some(e=>e.isEqual(t.key))}}function Oa(n,t){var e;return(((e=t.arrayValue)==null?void 0:e.values)||[]).map(r=>k.fromName(r.referenceValue))}class Rh extends st{constructor(t,e){super(t,"array-contains",e)}matches(t){const e=t.data.field(this.field);return Rs(e)&&mn(e.arrayValue,this.value)}}class Sh extends st{constructor(t,e){super(t,"in",e)}matches(t){const e=t.data.field(this.field);return e!==null&&mn(this.value.arrayValue,e)}}class Ch extends st{constructor(t,e){super(t,"not-in",e)}matches(t){if(mn(this.value.arrayValue,{nullValue:"NULL_VALUE"}))return!1;const e=t.data.field(this.field);return e!==null&&e.nullValue===void 0&&!mn(this.value.arrayValue,e)}}class bh extends st{constructor(t,e){super(t,"array-contains-any",e)}matches(t){const e=t.data.field(this.field);return!(!Rs(e)||!e.arrayValue.values)&&e.arrayValue.values.some(r=>mn(this.value.arrayValue,r))}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ph{constructor(t,e=null,r=[],i=[],o=null,u=null,l=null){this.path=t,this.collectionGroup=e,this.orderBy=r,this.filters=i,this.limit=o,this.startAt=u,this.endAt=l,this.Te=null}}function Eo(n,t=null,e=[],r=[],i=null,o=null,u=null){return new Ph(n,t,e,r,i,o,u)}function Ss(n){const t=q(n);if(t.Te===null){let e=t.path.canonicalString();t.collectionGroup!==null&&(e+="|cg:"+t.collectionGroup),e+="|f:",e+=t.filters.map(r=>as(r)).join(","),e+="|ob:",e+=t.orderBy.map(r=>function(o){return o.field.canonicalString()+o.dir}(r)).join(","),sr(t.limit)||(e+="|l:",e+=t.limit),t.startAt&&(e+="|lb:",e+=t.startAt.inclusive?"b:":"a:",e+=t.startAt.position.map(r=>be(r)).join(",")),t.endAt&&(e+="|ub:",e+=t.endAt.inclusive?"a:":"b:",e+=t.endAt.position.map(r=>be(r)).join(",")),t.Te=e}return t.Te}function Cs(n,t){if(n.limit!==t.limit||n.orderBy.length!==t.orderBy.length)return!1;for(let e=0;e<n.orderBy.length;e++)if(!Th(n.orderBy[e],t.orderBy[e]))return!1;if(n.filters.length!==t.filters.length)return!1;for(let e=0;e<n.filters.length;e++)if(!Na(n.filters[e],t.filters[e]))return!1;return n.collectionGroup===t.collectionGroup&&!!n.path.isEqual(t.path)&&!!yo(n.startAt,t.startAt)&&yo(n.endAt,t.endAt)}function us(n){return k.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class or{constructor(t,e=null,r=[],i=[],o=null,u="F",l=null,f=null){this.path=t,this.collectionGroup=e,this.explicitOrderBy=r,this.filters=i,this.limit=o,this.limitType=u,this.startAt=l,this.endAt=f,this.Ie=null,this.Ee=null,this.Re=null,this.startAt,this.endAt}}function Vh(n,t,e,r,i,o,u,l){return new or(n,t,e,r,i,o,u,l)}function xa(n){return new or(n)}function To(n){return n.filters.length===0&&n.limit===null&&n.startAt==null&&n.endAt==null&&(n.explicitOrderBy.length===0||n.explicitOrderBy.length===1&&n.explicitOrderBy[0].field.isKeyField())}function Dh(n){return k.isDocumentKey(n.path)&&n.collectionGroup===null&&n.filters.length===0}function Nh(n){return n.collectionGroup!==null}function sn(n){const t=q(n);if(t.Ie===null){t.Ie=[];const e=new Set;for(const o of t.explicitOrderBy)t.Ie.push(o),e.add(o.field.canonicalString());const r=t.explicitOrderBy.length>0?t.explicitOrderBy[t.explicitOrderBy.length-1].dir:"asc";(function(u){let l=new it(yt.comparator);return u.filters.forEach(f=>{f.getFlattenedFilters().forEach(d=>{d.isInequality()&&(l=l.add(d.field))})}),l})(t).forEach(o=>{e.has(o.canonicalString())||o.isKeyField()||t.Ie.push(new Yn(o,r))}),e.has(yt.keyField().canonicalString())||t.Ie.push(new Yn(yt.keyField(),r))}return t.Ie}function Pt(n){const t=q(n);return t.Ee||(t.Ee=kh(t,sn(n))),t.Ee}function kh(n,t){if(n.limitType==="F")return Eo(n.path,n.collectionGroup,t,n.filters,n.limit,n.startAt,n.endAt);{t=t.map(i=>{const o=i.dir==="desc"?"asc":"desc";return new Yn(i.field,o)});const e=n.endAt?new Jn(n.endAt.position,n.endAt.inclusive):null,r=n.startAt?new Jn(n.startAt.position,n.startAt.inclusive):null;return Eo(n.path,n.collectionGroup,t,n.filters,n.limit,e,r)}}function cs(n,t,e){return new or(n.path,n.collectionGroup,n.explicitOrderBy.slice(),n.filters.slice(),t,e,n.startAt,n.endAt)}function ar(n,t){return Cs(Pt(n),Pt(t))&&n.limitType===t.limitType}function Ma(n){return`${Ss(Pt(n))}|lt:${n.limitType}`}function ge(n){return`Query(target=${function(e){let r=e.path.canonicalString();return e.collectionGroup!==null&&(r+=" collectionGroup="+e.collectionGroup),e.filters.length>0&&(r+=`, filters: [${e.filters.map(i=>ka(i)).join(", ")}]`),sr(e.limit)||(r+=", limit: "+e.limit),e.orderBy.length>0&&(r+=`, orderBy: [${e.orderBy.map(i=>function(u){return`${u.field.canonicalString()} (${u.dir})`}(i)).join(", ")}]`),e.startAt&&(r+=", startAt: ",r+=e.startAt.inclusive?"b:":"a:",r+=e.startAt.position.map(i=>be(i)).join(",")),e.endAt&&(r+=", endAt: ",r+=e.endAt.inclusive?"a:":"b:",r+=e.endAt.position.map(i=>be(i)).join(",")),`Target(${r})`}(Pt(n))}; limitType=${n.limitType})`}function ur(n,t){return t.isFoundDocument()&&function(r,i){const o=i.key.path;return r.collectionGroup!==null?i.key.hasCollectionId(r.collectionGroup)&&r.path.isPrefixOf(o):k.isDocumentKey(r.path)?r.path.isEqual(o):r.path.isImmediateParentOf(o)}(n,t)&&function(r,i){for(const o of sn(r))if(!o.field.isKeyField()&&i.data.field(o.field)===null)return!1;return!0}(n,t)&&function(r,i){for(const o of r.filters)if(!o.matches(i))return!1;return!0}(n,t)&&function(r,i){return!(r.startAt&&!function(u,l,f){const d=_o(u,l,f);return u.inclusive?d<=0:d<0}(r.startAt,sn(r),i)||r.endAt&&!function(u,l,f){const d=_o(u,l,f);return u.inclusive?d>=0:d>0}(r.endAt,sn(r),i))}(n,t)}function Oh(n){return n.collectionGroup||(n.path.length%2==1?n.path.lastSegment():n.path.get(n.path.length-2))}function La(n){return(t,e)=>{let r=!1;for(const i of sn(n)){const o=xh(i,t,e);if(o!==0)return o;r=r||i.field.isKeyField()}return 0}}function xh(n,t,e){const r=n.field.isKeyField()?k.comparator(t.key,e.key):function(o,u,l){const f=u.data.field(o),d=l.data.field(o);return f!==null&&d!==null?Ce(f,d):M(42886)}(n.field,t,e);switch(n.dir){case"asc":return r;case"desc":return-1*r;default:return M(19790,{direction:n.dir})}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class he{constructor(t,e){this.mapKeyFn=t,this.equalsFn=e,this.inner={},this.innerSize=0}get(t){const e=this.mapKeyFn(t),r=this.inner[e];if(r!==void 0){for(const[i,o]of r)if(this.equalsFn(i,t))return o}}has(t){return this.get(t)!==void 0}set(t,e){const r=this.mapKeyFn(t),i=this.inner[r];if(i===void 0)return this.inner[r]=[[t,e]],void this.innerSize++;for(let o=0;o<i.length;o++)if(this.equalsFn(i[o][0],t))return void(i[o]=[t,e]);i.push([t,e]),this.innerSize++}delete(t){const e=this.mapKeyFn(t),r=this.inner[e];if(r===void 0)return!1;for(let i=0;i<r.length;i++)if(this.equalsFn(r[i][0],t))return r.length===1?delete this.inner[e]:r.splice(i,1),this.innerSize--,!0;return!1}forEach(t){gn(this.inner,(e,r)=>{for(const[i,o]of r)t(i,o)})}isEmpty(){return hh(this.inner)}size(){return this.innerSize}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Mh=new Z(k.comparator);function Yt(){return Mh}const Fa=new Z(k.comparator);function tn(...n){let t=Fa;for(const e of n)t=t.insert(e.key,e);return t}function Lh(n){let t=Fa;return n.forEach((e,r)=>t=t.insert(e,r.overlayedDocument)),t}function oe(){return on()}function Ua(){return on()}function on(){return new he(n=>n.toString(),(n,t)=>n.isEqual(t))}const Fh=new it(k.comparator);function $(...n){let t=Fh;for(const e of n)t=t.add(e);return t}const Uh=new it(U);function Bh(){return Uh}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function jh(n,t){if(n.useProto3Json){if(isNaN(t))return{doubleValue:"NaN"};if(t===1/0)return{doubleValue:"Infinity"};if(t===-1/0)return{doubleValue:"-Infinity"}}return{doubleValue:rs(t)?"-0":t}}function qh(n){return{integerValue:""+n}}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class cr{constructor(){this._=void 0}}function $h(n,t,e){return n instanceof ls?function(i,o){const u={fields:{[Sa]:{stringValue:Ra},[ba]:{timestampValue:{seconds:i.seconds,nanos:i.nanoseconds}}}};return o&&As(o)&&(o=ir(o)),o&&(u.fields[Ca]=o),{mapValue:u}}(e,t):n instanceof Xn?Ba(n,t):n instanceof Zn?ja(n,t):function(i,o){const u=Hh(i,o),l=vo(u)+vo(i.Ae);return os(u)&&os(i.Ae)?qh(l):jh(i.serializer,l)}(n,t)}function zh(n,t,e){return n instanceof Xn?Ba(n,t):n instanceof Zn?ja(n,t):e}function Hh(n,t){return n instanceof hs?function(r){return os(r)||function(o){return!!o&&"doubleValue"in o}(r)}(t)?t:{integerValue:0}:null}class ls extends cr{}class Xn extends cr{constructor(t){super(),this.elements=t}}function Ba(n,t){const e=qa(t);for(const r of n.elements)e.some(i=>Vt(i,r))||e.push(r);return{arrayValue:{values:e}}}class Zn extends cr{constructor(t){super(),this.elements=t}}function ja(n,t){let e=qa(t);for(const r of n.elements)e=e.filter(i=>!Vt(i,r));return{arrayValue:{values:e}}}class hs extends cr{constructor(t,e){super(),this.serializer=t,this.Ae=e}}function vo(n){return X(n.integerValue||n.doubleValue)}function qa(n){return Rs(n)&&n.arrayValue.values?n.arrayValue.values.slice():[]}function Gh(n,t){return n.field.isEqual(t.field)&&function(r,i){return r instanceof Xn&&i instanceof Xn||r instanceof Zn&&i instanceof Zn?Se(r.elements,i.elements,Vt):r instanceof hs&&i instanceof hs?Vt(r.Ae,i.Ae):r instanceof ls&&i instanceof ls}(n.transform,t.transform)}class ue{constructor(t,e){this.updateTime=t,this.exists=e}static none(){return new ue}static exists(t){return new ue(void 0,t)}static updateTime(t){return new ue(t)}get isNone(){return this.updateTime===void 0&&this.exists===void 0}isEqual(t){return this.exists===t.exists&&(this.updateTime?!!t.updateTime&&this.updateTime.isEqual(t.updateTime):!t.updateTime)}}function $n(n,t){return n.updateTime!==void 0?t.isFoundDocument()&&t.version.isEqual(n.updateTime):n.exists===void 0||n.exists===t.isFoundDocument()}class bs{}function $a(n,t){if(!n.hasLocalMutations||t&&t.fields.length===0)return null;if(t===null)return n.isNoDocument()?new Qh(n.key,ue.none()):new Ps(n.key,n.data,ue.none());{const e=n.data,r=Ct.empty();let i=new it(yt.comparator);for(let o of t.fields)if(!i.has(o)){let u=e.field(o);u===null&&o.length>1&&(o=o.popLast(),u=e.field(o)),u===null?r.delete(o):r.set(o,u),i=i.add(o)}return new lr(n.key,r,new Bt(i.toArray()),ue.none())}}function Kh(n,t,e){n instanceof Ps?function(i,o,u){const l=i.value.clone(),f=wo(i.fieldTransforms,o,u.transformResults);l.setAll(f),o.convertToFoundDocument(u.version,l).setHasCommittedMutations()}(n,t,e):n instanceof lr?function(i,o,u){if(!$n(i.precondition,o))return void o.convertToUnknownDocument(u.version);const l=wo(i.fieldTransforms,o,u.transformResults),f=o.data;f.setAll(za(i)),f.setAll(l),o.convertToFoundDocument(u.version,f).setHasCommittedMutations()}(n,t,e):function(i,o,u){o.convertToNoDocument(u.version).setHasCommittedMutations()}(0,t,e)}function an(n,t,e,r){return n instanceof Ps?function(o,u,l,f){if(!$n(o.precondition,u))return l;const d=o.value.clone(),_=Ao(o.fieldTransforms,f,u);return d.setAll(_),u.convertToFoundDocument(u.version,d).setHasLocalMutations(),null}(n,t,e,r):n instanceof lr?function(o,u,l,f){if(!$n(o.precondition,u))return l;const d=Ao(o.fieldTransforms,f,u),_=u.data;return _.setAll(za(o)),_.setAll(d),u.convertToFoundDocument(u.version,_).setHasLocalMutations(),l===null?null:l.unionWith(o.fieldMask.fields).unionWith(o.fieldTransforms.map(v=>v.field))}(n,t,e,r):function(o,u,l){return $n(o.precondition,u)?(u.convertToNoDocument(u.version).setHasLocalMutations(),null):l}(n,t,e)}function Io(n,t){return n.type===t.type&&!!n.key.isEqual(t.key)&&!!n.precondition.isEqual(t.precondition)&&!!function(r,i){return r===void 0&&i===void 0||!(!r||!i)&&Se(r,i,(o,u)=>Gh(o,u))}(n.fieldTransforms,t.fieldTransforms)&&(n.type===0?n.value.isEqual(t.value):n.type!==1||n.data.isEqual(t.data)&&n.fieldMask.isEqual(t.fieldMask))}class Ps extends bs{constructor(t,e,r,i=[]){super(),this.key=t,this.value=e,this.precondition=r,this.fieldTransforms=i,this.type=0}getFieldMask(){return null}}class lr extends bs{constructor(t,e,r,i,o=[]){super(),this.key=t,this.data=e,this.fieldMask=r,this.precondition=i,this.fieldTransforms=o,this.type=1}getFieldMask(){return this.fieldMask}}function za(n){const t=new Map;return n.fieldMask.fields.forEach(e=>{if(!e.isEmpty()){const r=n.data.field(e);t.set(e,r)}}),t}function wo(n,t,e){const r=new Map;Q(n.length===e.length,32656,{Ve:e.length,de:n.length});for(let i=0;i<e.length;i++){const o=n[i],u=o.transform,l=t.data.field(o.field);r.set(o.field,zh(u,l,e[i]))}return r}function Ao(n,t,e){const r=new Map;for(const i of n){const o=i.transform,u=e.data.field(i.field);r.set(i.field,$h(o,u,t))}return r}class Qh extends bs{constructor(t,e){super(),this.key=t,this.precondition=e,this.type=2,this.fieldTransforms=[]}getFieldMask(){return null}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Wh{constructor(t,e,r,i){this.batchId=t,this.localWriteTime=e,this.baseMutations=r,this.mutations=i}applyToRemoteDocument(t,e){const r=e.mutationResults;for(let i=0;i<this.mutations.length;i++){const o=this.mutations[i];o.key.isEqual(t.key)&&Kh(o,t,r[i])}}applyToLocalView(t,e){for(const r of this.baseMutations)r.key.isEqual(t.key)&&(e=an(r,t,e,this.localWriteTime));for(const r of this.mutations)r.key.isEqual(t.key)&&(e=an(r,t,e,this.localWriteTime));return e}applyToLocalDocumentSet(t,e){const r=Ua();return this.mutations.forEach(i=>{const o=t.get(i.key),u=o.overlayedDocument;let l=this.applyToLocalView(u,o.mutatedFields);l=e.has(i.key)?null:l;const f=$a(u,l);f!==null&&r.set(i.key,f),u.isValidDocument()||u.convertToNoDocument(x.min())}),r}keys(){return this.mutations.reduce((t,e)=>t.add(e.key),$())}isEqual(t){return this.batchId===t.batchId&&Se(this.mutations,t.mutations,(e,r)=>Io(e,r))&&Se(this.baseMutations,t.baseMutations,(e,r)=>Io(e,r))}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Jh{constructor(t,e){this.largestBatchId=t,this.mutation=e}getKey(){return this.mutation.key}isEqual(t){return t!==null&&this.mutation===t.mutation}toString(){return`Overlay{
      largestBatchId: ${this.largestBatchId},
      mutation: ${this.mutation.toString()}
    }`}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yh{constructor(t,e){this.count=t,this.unchangedNames=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var tt,B;function Ha(n){if(n===void 0)return kt("GRPC error has no .code"),P.UNKNOWN;switch(n){case tt.OK:return P.OK;case tt.CANCELLED:return P.CANCELLED;case tt.UNKNOWN:return P.UNKNOWN;case tt.DEADLINE_EXCEEDED:return P.DEADLINE_EXCEEDED;case tt.RESOURCE_EXHAUSTED:return P.RESOURCE_EXHAUSTED;case tt.INTERNAL:return P.INTERNAL;case tt.UNAVAILABLE:return P.UNAVAILABLE;case tt.UNAUTHENTICATED:return P.UNAUTHENTICATED;case tt.INVALID_ARGUMENT:return P.INVALID_ARGUMENT;case tt.NOT_FOUND:return P.NOT_FOUND;case tt.ALREADY_EXISTS:return P.ALREADY_EXISTS;case tt.PERMISSION_DENIED:return P.PERMISSION_DENIED;case tt.FAILED_PRECONDITION:return P.FAILED_PRECONDITION;case tt.ABORTED:return P.ABORTED;case tt.OUT_OF_RANGE:return P.OUT_OF_RANGE;case tt.UNIMPLEMENTED:return P.UNIMPLEMENTED;case tt.DATA_LOSS:return P.DATA_LOSS;default:return M(39323,{code:n})}}(B=tt||(tt={}))[B.OK=0]="OK",B[B.CANCELLED=1]="CANCELLED",B[B.UNKNOWN=2]="UNKNOWN",B[B.INVALID_ARGUMENT=3]="INVALID_ARGUMENT",B[B.DEADLINE_EXCEEDED=4]="DEADLINE_EXCEEDED",B[B.NOT_FOUND=5]="NOT_FOUND",B[B.ALREADY_EXISTS=6]="ALREADY_EXISTS",B[B.PERMISSION_DENIED=7]="PERMISSION_DENIED",B[B.UNAUTHENTICATED=16]="UNAUTHENTICATED",B[B.RESOURCE_EXHAUSTED=8]="RESOURCE_EXHAUSTED",B[B.FAILED_PRECONDITION=9]="FAILED_PRECONDITION",B[B.ABORTED=10]="ABORTED",B[B.OUT_OF_RANGE=11]="OUT_OF_RANGE",B[B.UNIMPLEMENTED=12]="UNIMPLEMENTED",B[B.INTERNAL=13]="INTERNAL",B[B.UNAVAILABLE=14]="UNAVAILABLE",B[B.DATA_LOSS=15]="DATA_LOSS";/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xh(){return new TextEncoder}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Zh=new zt([4294967295,4294967295],0);function Ro(n){const t=Xh().encode(n),e=new ma;return e.update(t),new Uint8Array(e.digest())}function So(n){const t=new DataView(n.buffer),e=t.getUint32(0,!0),r=t.getUint32(4,!0),i=t.getUint32(8,!0),o=t.getUint32(12,!0);return[new zt([e,r],0),new zt([i,o],0)]}class Vs{constructor(t,e,r){if(this.bitmap=t,this.padding=e,this.hashCount=r,e<0||e>=8)throw new en(`Invalid padding: ${e}`);if(r<0)throw new en(`Invalid hash count: ${r}`);if(t.length>0&&this.hashCount===0)throw new en(`Invalid hash count: ${r}`);if(t.length===0&&e!==0)throw new en(`Invalid padding when bitmap length is 0: ${e}`);this.ge=8*t.length-e,this.pe=zt.fromNumber(this.ge)}ye(t,e,r){let i=t.add(e.multiply(zt.fromNumber(r)));return i.compare(Zh)===1&&(i=new zt([i.getBits(0),i.getBits(1)],0)),i.modulo(this.pe).toNumber()}we(t){return!!(this.bitmap[Math.floor(t/8)]&1<<t%8)}mightContain(t){if(this.ge===0)return!1;const e=Ro(t),[r,i]=So(e);for(let o=0;o<this.hashCount;o++){const u=this.ye(r,i,o);if(!this.we(u))return!1}return!0}static create(t,e,r){const i=t%8==0?0:8-t%8,o=new Uint8Array(Math.ceil(t/8)),u=new Vs(o,i,e);return r.forEach(l=>u.insert(l)),u}insert(t){if(this.ge===0)return;const e=Ro(t),[r,i]=So(e);for(let o=0;o<this.hashCount;o++){const u=this.ye(r,i,o);this.be(u)}}be(t){const e=Math.floor(t/8),r=t%8;this.bitmap[e]|=1<<r}}class en extends Error{constructor(){super(...arguments),this.name="BloomFilterError"}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hr{constructor(t,e,r,i,o){this.snapshotVersion=t,this.targetChanges=e,this.targetMismatches=r,this.documentUpdates=i,this.resolvedLimboDocuments=o}static createSynthesizedRemoteEventForCurrentChange(t,e,r){const i=new Map;return i.set(t,_n.createSynthesizedTargetChangeForCurrentChange(t,e,r)),new hr(x.min(),i,new Z(U),Yt(),$())}}class _n{constructor(t,e,r,i,o){this.resumeToken=t,this.current=e,this.addedDocuments=r,this.modifiedDocuments=i,this.removedDocuments=o}static createSynthesizedTargetChangeForCurrentChange(t,e,r){return new _n(r,e,$(),$(),$())}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class zn{constructor(t,e,r,i){this.Se=t,this.removedTargetIds=e,this.key=r,this.De=i}}class Ga{constructor(t,e){this.targetId=t,this.Ce=e}}class Ka{constructor(t,e,r=ct.EMPTY_BYTE_STRING,i=null){this.state=t,this.targetIds=e,this.resumeToken=r,this.cause=i}}class Co{constructor(){this.ve=0,this.Fe=bo(),this.Me=ct.EMPTY_BYTE_STRING,this.xe=!1,this.Oe=!0}get current(){return this.xe}get resumeToken(){return this.Me}get Ne(){return this.ve!==0}get Be(){return this.Oe}Le(t){t.approximateByteSize()>0&&(this.Oe=!0,this.Me=t)}ke(){let t=$(),e=$(),r=$();return this.Fe.forEach((i,o)=>{switch(o){case 0:t=t.add(i);break;case 2:e=e.add(i);break;case 1:r=r.add(i);break;default:M(38017,{changeType:o})}}),new _n(this.Me,this.xe,t,e,r)}Ke(){this.Oe=!1,this.Fe=bo()}qe(t,e){this.Oe=!0,this.Fe=this.Fe.insert(t,e)}Ue(t){this.Oe=!0,this.Fe=this.Fe.remove(t)}$e(){this.ve+=1}We(){this.ve-=1,Q(this.ve>=0,3241,{ve:this.ve})}Qe(){this.Oe=!0,this.xe=!0}}class tf{constructor(t){this.Ge=t,this.ze=new Map,this.je=Yt(),this.He=Fn(),this.Je=Fn(),this.Ze=new Z(U)}Xe(t){for(const e of t.Se)t.De&&t.De.isFoundDocument()?this.Ye(e,t.De):this.et(e,t.key,t.De);for(const e of t.removedTargetIds)this.et(e,t.key,t.De)}tt(t){this.forEachTarget(t,e=>{const r=this.nt(e);switch(t.state){case 0:this.rt(e)&&r.Le(t.resumeToken);break;case 1:r.We(),r.Ne||r.Ke(),r.Le(t.resumeToken);break;case 2:r.We(),r.Ne||this.removeTarget(e);break;case 3:this.rt(e)&&(r.Qe(),r.Le(t.resumeToken));break;case 4:this.rt(e)&&(this.it(e),r.Le(t.resumeToken));break;default:M(56790,{state:t.state})}})}forEachTarget(t,e){t.targetIds.length>0?t.targetIds.forEach(e):this.ze.forEach((r,i)=>{this.rt(i)&&e(i)})}st(t){const e=t.targetId,r=t.Ce.count,i=this.ot(e);if(i){const o=i.target;if(us(o))if(r===0){const u=new k(o.path);this.et(e,u,pt.newNoDocument(u,x.min()))}else Q(r===1,20013,{expectedCount:r});else{const u=this._t(e);if(u!==r){const l=this.ut(t),f=l?this.ct(l,t,u):1;if(f!==0){this.it(e);const d=f===2?"TargetPurposeExistenceFilterMismatchBloom":"TargetPurposeExistenceFilterMismatch";this.Ze=this.Ze.insert(e,d)}}}}}ut(t){const e=t.Ce.unchangedNames;if(!e||!e.bits)return null;const{bits:{bitmap:r="",padding:i=0},hashCount:o=0}=e;let u,l;try{u=Wt(r).toUint8Array()}catch(f){if(f instanceof Aa)return le("Decoding the base64 bloom filter in existence filter failed ("+f.message+"); ignoring the bloom filter and falling back to full re-query."),null;throw f}try{l=new Vs(u,i,o)}catch(f){return le(f instanceof en?"BloomFilter error: ":"Applying bloom filter failed: ",f),null}return l.ge===0?null:l}ct(t,e,r){return e.Ce.count===r-this.Pt(t,e.targetId)?0:2}Pt(t,e){const r=this.Ge.getRemoteKeysForTarget(e);let i=0;return r.forEach(o=>{const u=this.Ge.ht(),l=`projects/${u.projectId}/databases/${u.database}/documents/${o.path.canonicalString()}`;t.mightContain(l)||(this.et(e,o,null),i++)}),i}Tt(t){const e=new Map;this.ze.forEach((o,u)=>{const l=this.ot(u);if(l){if(o.current&&us(l.target)){const f=new k(l.target.path);this.It(f).has(u)||this.Et(u,f)||this.et(u,f,pt.newNoDocument(f,t))}o.Be&&(e.set(u,o.ke()),o.Ke())}});let r=$();this.Je.forEach((o,u)=>{let l=!0;u.forEachWhile(f=>{const d=this.ot(f);return!d||d.purpose==="TargetPurposeLimboResolution"||(l=!1,!1)}),l&&(r=r.add(o))}),this.je.forEach((o,u)=>u.setReadTime(t));const i=new hr(t,e,this.Ze,this.je,r);return this.je=Yt(),this.He=Fn(),this.Je=Fn(),this.Ze=new Z(U),i}Ye(t,e){if(!this.rt(t))return;const r=this.Et(t,e.key)?2:0;this.nt(t).qe(e.key,r),this.je=this.je.insert(e.key,e),this.He=this.He.insert(e.key,this.It(e.key).add(t)),this.Je=this.Je.insert(e.key,this.Rt(e.key).add(t))}et(t,e,r){if(!this.rt(t))return;const i=this.nt(t);this.Et(t,e)?i.qe(e,1):i.Ue(e),this.Je=this.Je.insert(e,this.Rt(e).delete(t)),this.Je=this.Je.insert(e,this.Rt(e).add(t)),r&&(this.je=this.je.insert(e,r))}removeTarget(t){this.ze.delete(t)}_t(t){const e=this.nt(t).ke();return this.Ge.getRemoteKeysForTarget(t).size+e.addedDocuments.size-e.removedDocuments.size}$e(t){this.nt(t).$e()}nt(t){let e=this.ze.get(t);return e||(e=new Co,this.ze.set(t,e)),e}Rt(t){let e=this.Je.get(t);return e||(e=new it(U),this.Je=this.Je.insert(t,e)),e}It(t){let e=this.He.get(t);return e||(e=new it(U),this.He=this.He.insert(t,e)),e}rt(t){const e=this.ot(t)!==null;return e||V("WatchChangeAggregator","Detected inactive target",t),e}ot(t){const e=this.ze.get(t);return e&&e.Ne?null:this.Ge.At(t)}it(t){this.ze.set(t,new Co),this.Ge.getRemoteKeysForTarget(t).forEach(e=>{this.et(t,e,null)})}Et(t,e){return this.Ge.getRemoteKeysForTarget(t).has(e)}}function Fn(){return new Z(k.comparator)}function bo(){return new Z(k.comparator)}const ef={asc:"ASCENDING",desc:"DESCENDING"},nf={"<":"LESS_THAN","<=":"LESS_THAN_OR_EQUAL",">":"GREATER_THAN",">=":"GREATER_THAN_OR_EQUAL","==":"EQUAL","!=":"NOT_EQUAL","array-contains":"ARRAY_CONTAINS",in:"IN","not-in":"NOT_IN","array-contains-any":"ARRAY_CONTAINS_ANY"},rf={and:"AND",or:"OR"};class sf{constructor(t,e){this.databaseId=t,this.useProto3Json=e}}function fs(n,t){return n.useProto3Json||sr(t)?t:{value:t}}function of(n,t){return n.useProto3Json?`${new Date(1e3*t.seconds).toISOString().replace(/\.\d*/,"").replace("Z","")}.${("000000000"+t.nanoseconds).slice(-9)}Z`:{seconds:""+t.seconds,nanos:t.nanoseconds}}function af(n,t){return n.useProto3Json?t.toBase64():t.toUint8Array()}function Te(n){return Q(!!n,49232),x.fromTimestamp(function(e){const r=Qt(e);return new et(r.seconds,r.nanos)}(n))}function uf(n,t){return ds(n,t).canonicalString()}function ds(n,t){const e=function(i){return new K(["projects",i.projectId,"databases",i.database])}(n).child("documents");return t===void 0?e:e.child(t)}function Qa(n){const t=K.fromString(n);return Q(Za(t),10190,{key:t.toString()}),t}function zr(n,t){const e=Qa(t);if(e.get(1)!==n.databaseId.projectId)throw new D(P.INVALID_ARGUMENT,"Tried to deserialize key from different project: "+e.get(1)+" vs "+n.databaseId.projectId);if(e.get(3)!==n.databaseId.database)throw new D(P.INVALID_ARGUMENT,"Tried to deserialize key from different database: "+e.get(3)+" vs "+n.databaseId.database);return new k(Ja(e))}function Wa(n,t){return uf(n.databaseId,t)}function cf(n){const t=Qa(n);return t.length===4?K.emptyPath():Ja(t)}function Po(n){return new K(["projects",n.databaseId.projectId,"databases",n.databaseId.database]).canonicalString()}function Ja(n){return Q(n.length>4&&n.get(4)==="documents",29091,{key:n.toString()}),n.popFirst(5)}function lf(n,t){let e;if("targetChange"in t){t.targetChange;const r=function(d){return d==="NO_CHANGE"?0:d==="ADD"?1:d==="REMOVE"?2:d==="CURRENT"?3:d==="RESET"?4:M(39313,{state:d})}(t.targetChange.targetChangeType||"NO_CHANGE"),i=t.targetChange.targetIds||[],o=function(d,_){return d.useProto3Json?(Q(_===void 0||typeof _=="string",58123),ct.fromBase64String(_||"")):(Q(_===void 0||_ instanceof Buffer||_ instanceof Uint8Array,16193),ct.fromUint8Array(_||new Uint8Array))}(n,t.targetChange.resumeToken),u=t.targetChange.cause,l=u&&function(d){const _=d.code===void 0?P.UNKNOWN:Ha(d.code);return new D(_,d.message||"")}(u);e=new Ka(r,i,o,l||null)}else if("documentChange"in t){t.documentChange;const r=t.documentChange;r.document,r.document.name,r.document.updateTime;const i=zr(n,r.document.name),o=Te(r.document.updateTime),u=r.document.createTime?Te(r.document.createTime):x.min(),l=new Ct({mapValue:{fields:r.document.fields}}),f=pt.newFoundDocument(i,o,u,l),d=r.targetIds||[],_=r.removedTargetIds||[];e=new zn(d,_,f.key,f)}else if("documentDelete"in t){t.documentDelete;const r=t.documentDelete;r.document;const i=zr(n,r.document),o=r.readTime?Te(r.readTime):x.min(),u=pt.newNoDocument(i,o),l=r.removedTargetIds||[];e=new zn([],l,u.key,u)}else if("documentRemove"in t){t.documentRemove;const r=t.documentRemove;r.document;const i=zr(n,r.document),o=r.removedTargetIds||[];e=new zn([],o,i,null)}else{if(!("filter"in t))return M(11601,{Vt:t});{t.filter;const r=t.filter;r.targetId;const{count:i=0,unchangedNames:o}=r,u=new Yh(i,o),l=r.targetId;e=new Ga(l,u)}}return e}function hf(n,t){return{documents:[Wa(n,t.path)]}}function ff(n,t){const e={structuredQuery:{}},r=t.path;let i;t.collectionGroup!==null?(i=r,e.structuredQuery.from=[{collectionId:t.collectionGroup,allDescendants:!0}]):(i=r.popLast(),e.structuredQuery.from=[{collectionId:r.lastSegment()}]),e.parent=Wa(n,i);const o=function(d){if(d.length!==0)return Xa(Dt.create(d,"and"))}(t.filters);o&&(e.structuredQuery.where=o);const u=function(d){if(d.length!==0)return d.map(_=>function(R){return{field:_e(R.field),direction:pf(R.dir)}}(_))}(t.orderBy);u&&(e.structuredQuery.orderBy=u);const l=fs(n,t.limit);return l!==null&&(e.structuredQuery.limit=l),t.startAt&&(e.structuredQuery.startAt=function(d){return{before:d.inclusive,values:d.position}}(t.startAt)),t.endAt&&(e.structuredQuery.endAt=function(d){return{before:!d.inclusive,values:d.position}}(t.endAt)),{ft:e,parent:i}}function df(n){let t=cf(n.parent);const e=n.structuredQuery,r=e.from?e.from.length:0;let i=null;if(r>0){Q(r===1,65062);const _=e.from[0];_.allDescendants?i=_.collectionId:t=t.child(_.collectionId)}let o=[];e.where&&(o=function(v){const R=Ya(v);return R instanceof Dt&&Da(R)?R.getFilters():[R]}(e.where));let u=[];e.orderBy&&(u=function(v){return v.map(R=>function(O){return new Yn(ye(O.field),function(N){switch(N){case"ASCENDING":return"asc";case"DESCENDING":return"desc";default:return}}(O.direction))}(R))}(e.orderBy));let l=null;e.limit&&(l=function(v){let R;return R=typeof v=="object"?v.value:v,sr(R)?null:R}(e.limit));let f=null;e.startAt&&(f=function(v){const R=!!v.before,C=v.values||[];return new Jn(C,R)}(e.startAt));let d=null;return e.endAt&&(d=function(v){const R=!v.before,C=v.values||[];return new Jn(C,R)}(e.endAt)),Vh(t,i,u,o,l,"F",f,d)}function mf(n,t){const e=function(i){switch(i){case"TargetPurposeListen":return null;case"TargetPurposeExistenceFilterMismatch":return"existence-filter-mismatch";case"TargetPurposeExistenceFilterMismatchBloom":return"existence-filter-mismatch-bloom";case"TargetPurposeLimboResolution":return"limbo-document";default:return M(28987,{purpose:i})}}(t.purpose);return e==null?null:{"goog-listen-tags":e}}function Ya(n){return n.unaryFilter!==void 0?function(e){switch(e.unaryFilter.op){case"IS_NAN":const r=ye(e.unaryFilter.field);return st.create(r,"==",{doubleValue:NaN});case"IS_NULL":const i=ye(e.unaryFilter.field);return st.create(i,"==",{nullValue:"NULL_VALUE"});case"IS_NOT_NAN":const o=ye(e.unaryFilter.field);return st.create(o,"!=",{doubleValue:NaN});case"IS_NOT_NULL":const u=ye(e.unaryFilter.field);return st.create(u,"!=",{nullValue:"NULL_VALUE"});case"OPERATOR_UNSPECIFIED":return M(61313);default:return M(60726)}}(n):n.fieldFilter!==void 0?function(e){return st.create(ye(e.fieldFilter.field),function(i){switch(i){case"EQUAL":return"==";case"NOT_EQUAL":return"!=";case"GREATER_THAN":return">";case"GREATER_THAN_OR_EQUAL":return">=";case"LESS_THAN":return"<";case"LESS_THAN_OR_EQUAL":return"<=";case"ARRAY_CONTAINS":return"array-contains";case"IN":return"in";case"NOT_IN":return"not-in";case"ARRAY_CONTAINS_ANY":return"array-contains-any";case"OPERATOR_UNSPECIFIED":return M(58110);default:return M(50506)}}(e.fieldFilter.op),e.fieldFilter.value)}(n):n.compositeFilter!==void 0?function(e){return Dt.create(e.compositeFilter.filters.map(r=>Ya(r)),function(i){switch(i){case"AND":return"and";case"OR":return"or";default:return M(1026)}}(e.compositeFilter.op))}(n):M(30097,{filter:n})}function pf(n){return ef[n]}function gf(n){return nf[n]}function _f(n){return rf[n]}function _e(n){return{fieldPath:n.canonicalString()}}function ye(n){return yt.fromServerFormat(n.fieldPath)}function Xa(n){return n instanceof st?function(e){if(e.op==="=="){if(go(e.value))return{unaryFilter:{field:_e(e.field),op:"IS_NAN"}};if(po(e.value))return{unaryFilter:{field:_e(e.field),op:"IS_NULL"}}}else if(e.op==="!="){if(go(e.value))return{unaryFilter:{field:_e(e.field),op:"IS_NOT_NAN"}};if(po(e.value))return{unaryFilter:{field:_e(e.field),op:"IS_NOT_NULL"}}}return{fieldFilter:{field:_e(e.field),op:gf(e.op),value:e.value}}}(n):n instanceof Dt?function(e){const r=e.getFilters().map(i=>Xa(i));return r.length===1?r[0]:{compositeFilter:{op:_f(e.op),filters:r}}}(n):M(54877,{filter:n})}function Za(n){return n.length>=4&&n.get(0)==="projects"&&n.get(2)==="databases"}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class jt{constructor(t,e,r,i,o=x.min(),u=x.min(),l=ct.EMPTY_BYTE_STRING,f=null){this.target=t,this.targetId=e,this.purpose=r,this.sequenceNumber=i,this.snapshotVersion=o,this.lastLimboFreeSnapshotVersion=u,this.resumeToken=l,this.expectedCount=f}withSequenceNumber(t){return new jt(this.target,this.targetId,this.purpose,t,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,this.expectedCount)}withResumeToken(t,e){return new jt(this.target,this.targetId,this.purpose,this.sequenceNumber,e,this.lastLimboFreeSnapshotVersion,t,null)}withExpectedCount(t){return new jt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,this.lastLimboFreeSnapshotVersion,this.resumeToken,t)}withLastLimboFreeSnapshotVersion(t){return new jt(this.target,this.targetId,this.purpose,this.sequenceNumber,this.snapshotVersion,t,this.resumeToken,this.expectedCount)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class yf{constructor(t){this.yt=t}}function Ef(n){const t=df({parent:n.parent,structuredQuery:n.structuredQuery});return n.limitType==="LAST"?cs(t,t.limit,"L"):t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Tf{constructor(){this.Sn=new vf}addToCollectionParentIndex(t,e){return this.Sn.add(e),S.resolve()}getCollectionParents(t,e){return S.resolve(this.Sn.getEntries(e))}addFieldIndex(t,e){return S.resolve()}deleteFieldIndex(t,e){return S.resolve()}deleteAllFieldIndexes(t){return S.resolve()}createTargetIndexes(t,e){return S.resolve()}getDocumentsMatchingTarget(t,e){return S.resolve(null)}getIndexType(t,e){return S.resolve(0)}getFieldIndexes(t,e){return S.resolve([])}getNextCollectionGroupToUpdate(t){return S.resolve(null)}getMinOffset(t,e){return S.resolve(Kt.min())}getMinOffsetFromCollectionGroup(t,e){return S.resolve(Kt.min())}updateCollectionGroup(t,e,r){return S.resolve()}updateIndexEntries(t,e){return S.resolve()}}class vf{constructor(){this.index={}}add(t){const e=t.lastSegment(),r=t.popLast(),i=this.index[e]||new it(K.comparator),o=!i.has(r);return this.index[e]=i.add(r),o}has(t){const e=t.lastSegment(),r=t.popLast(),i=this.index[e];return i&&i.has(r)}getEntries(t){return(this.index[t]||new it(K.comparator)).toArray()}}/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Vo={didRun:!1,sequenceNumbersCollected:0,targetsRemoved:0,documentsRemoved:0},tu=41943040;class vt{static withCacheSize(t){return new vt(t,vt.DEFAULT_COLLECTION_PERCENTILE,vt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT)}constructor(t,e,r){this.cacheSizeCollectionThreshold=t,this.percentileToCollect=e,this.maximumSequenceNumbersToCollect=r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */vt.DEFAULT_COLLECTION_PERCENTILE=10,vt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT=1e3,vt.DEFAULT=new vt(tu,vt.DEFAULT_COLLECTION_PERCENTILE,vt.DEFAULT_MAX_SEQUENCE_NUMBERS_TO_COLLECT),vt.DISABLED=new vt(-1,0,0);/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pe{constructor(t){this.sr=t}next(){return this.sr+=2,this.sr}static _r(){return new Pe(0)}static ar(){return new Pe(-1)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Do="LruGarbageCollector",If=1048576;function No([n,t],[e,r]){const i=U(n,e);return i===0?U(t,r):i}class wf{constructor(t){this.Pr=t,this.buffer=new it(No),this.Tr=0}Ir(){return++this.Tr}Er(t){const e=[t,this.Ir()];if(this.buffer.size<this.Pr)this.buffer=this.buffer.add(e);else{const r=this.buffer.last();No(e,r)<0&&(this.buffer=this.buffer.delete(r).add(e))}}get maxValue(){return this.buffer.last()[0]}}class Af{constructor(t,e,r){this.garbageCollector=t,this.asyncQueue=e,this.localStore=r,this.Rr=null}start(){this.garbageCollector.params.cacheSizeCollectionThreshold!==-1&&this.Ar(6e4)}stop(){this.Rr&&(this.Rr.cancel(),this.Rr=null)}get started(){return this.Rr!==null}Ar(t){V(Do,`Garbage collection scheduled in ${t}ms`),this.Rr=this.asyncQueue.enqueueAfterDelay("lru_garbage_collection",t,async()=>{this.Rr=null;try{await this.localStore.collectGarbage(this.garbageCollector)}catch(e){Oe(e)?V(Do,"Ignoring IndexedDB error during garbage collection: ",e):await nr(e)}await this.Ar(3e5)})}}class Rf{constructor(t,e){this.Vr=t,this.params=e}calculateTargetCount(t,e){return this.Vr.dr(t).next(r=>Math.floor(e/100*r))}nthSequenceNumber(t,e){if(e===0)return S.resolve(rr.ce);const r=new wf(e);return this.Vr.forEachTarget(t,i=>r.Er(i.sequenceNumber)).next(()=>this.Vr.mr(t,i=>r.Er(i))).next(()=>r.maxValue)}removeTargets(t,e,r){return this.Vr.removeTargets(t,e,r)}removeOrphanedDocuments(t,e){return this.Vr.removeOrphanedDocuments(t,e)}collect(t,e){return this.params.cacheSizeCollectionThreshold===-1?(V("LruGarbageCollector","Garbage collection skipped; disabled"),S.resolve(Vo)):this.getCacheSize(t).next(r=>r<this.params.cacheSizeCollectionThreshold?(V("LruGarbageCollector",`Garbage collection skipped; Cache size ${r} is lower than threshold ${this.params.cacheSizeCollectionThreshold}`),Vo):this.gr(t,e))}getCacheSize(t){return this.Vr.getCacheSize(t)}gr(t,e){let r,i,o,u,l,f,d;const _=Date.now();return this.calculateTargetCount(t,this.params.percentileToCollect).next(v=>(v>this.params.maximumSequenceNumbersToCollect?(V("LruGarbageCollector",`Capping sequence numbers to collect down to the maximum of ${this.params.maximumSequenceNumbersToCollect} from ${v}`),i=this.params.maximumSequenceNumbersToCollect):i=v,u=Date.now(),this.nthSequenceNumber(t,i))).next(v=>(r=v,l=Date.now(),this.removeTargets(t,r,e))).next(v=>(o=v,f=Date.now(),this.removeOrphanedDocuments(t,r))).next(v=>(d=Date.now(),pe()<=j.DEBUG&&V("LruGarbageCollector",`LRU Garbage Collection
	Counted targets in ${u-_}ms
	Determined least recently used ${i} in `+(l-u)+`ms
	Removed ${o} targets in `+(f-l)+`ms
	Removed ${v} documents in `+(d-f)+`ms
Total Duration: ${d-_}ms`),S.resolve({didRun:!0,sequenceNumbersCollected:i,targetsRemoved:o,documentsRemoved:v})))}}function Sf(n,t){return new Rf(n,t)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Cf{constructor(){this.changes=new he(t=>t.toString(),(t,e)=>t.isEqual(e)),this.changesApplied=!1}addEntry(t){this.assertNotApplied(),this.changes.set(t.key,t)}removeEntry(t,e){this.assertNotApplied(),this.changes.set(t,pt.newInvalidDocument(t).setReadTime(e))}getEntry(t,e){this.assertNotApplied();const r=this.changes.get(e);return r!==void 0?S.resolve(r):this.getFromCache(t,e)}getEntries(t,e){return this.getAllFromCache(t,e)}apply(t){return this.assertNotApplied(),this.changesApplied=!0,this.applyChanges(t)}assertNotApplied(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bf{constructor(t,e){this.overlayedDocument=t,this.mutatedFields=e}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Pf{constructor(t,e,r,i){this.remoteDocumentCache=t,this.mutationQueue=e,this.documentOverlayCache=r,this.indexManager=i}getDocument(t,e){let r=null;return this.documentOverlayCache.getOverlay(t,e).next(i=>(r=i,this.remoteDocumentCache.getEntry(t,e))).next(i=>(r!==null&&an(r.mutation,i,Bt.empty(),et.now()),i))}getDocuments(t,e){return this.remoteDocumentCache.getEntries(t,e).next(r=>this.getLocalViewOfDocuments(t,r,$()).next(()=>r))}getLocalViewOfDocuments(t,e,r=$()){const i=oe();return this.populateOverlays(t,i,e).next(()=>this.computeViews(t,e,i,r).next(o=>{let u=tn();return o.forEach((l,f)=>{u=u.insert(l,f.overlayedDocument)}),u}))}getOverlayedDocuments(t,e){const r=oe();return this.populateOverlays(t,r,e).next(()=>this.computeViews(t,e,r,$()))}populateOverlays(t,e,r){const i=[];return r.forEach(o=>{e.has(o)||i.push(o)}),this.documentOverlayCache.getOverlays(t,i).next(o=>{o.forEach((u,l)=>{e.set(u,l)})})}computeViews(t,e,r,i){let o=Yt();const u=on(),l=function(){return on()}();return e.forEach((f,d)=>{const _=r.get(d.key);i.has(d.key)&&(_===void 0||_.mutation instanceof lr)?o=o.insert(d.key,d):_!==void 0?(u.set(d.key,_.mutation.getFieldMask()),an(_.mutation,d,_.mutation.getFieldMask(),et.now())):u.set(d.key,Bt.empty())}),this.recalculateAndSaveOverlays(t,o).next(f=>(f.forEach((d,_)=>u.set(d,_)),e.forEach((d,_)=>l.set(d,new bf(_,u.get(d)??null))),l))}recalculateAndSaveOverlays(t,e){const r=on();let i=new Z((u,l)=>u-l),o=$();return this.mutationQueue.getAllMutationBatchesAffectingDocumentKeys(t,e).next(u=>{for(const l of u)l.keys().forEach(f=>{const d=e.get(f);if(d===null)return;let _=r.get(f)||Bt.empty();_=l.applyToLocalView(d,_),r.set(f,_);const v=(i.get(l.batchId)||$()).add(f);i=i.insert(l.batchId,v)})}).next(()=>{const u=[],l=i.getReverseIterator();for(;l.hasNext();){const f=l.getNext(),d=f.key,_=f.value,v=Ua();_.forEach(R=>{if(!o.has(R)){const C=$a(e.get(R),r.get(R));C!==null&&v.set(R,C),o=o.add(R)}}),u.push(this.documentOverlayCache.saveOverlays(t,d,v))}return S.waitFor(u)}).next(()=>r)}recalculateAndSaveOverlaysForDocumentKeys(t,e){return this.remoteDocumentCache.getEntries(t,e).next(r=>this.recalculateAndSaveOverlays(t,r))}getDocumentsMatchingQuery(t,e,r,i){return Dh(e)?this.getDocumentsMatchingDocumentQuery(t,e.path):Nh(e)?this.getDocumentsMatchingCollectionGroupQuery(t,e,r,i):this.getDocumentsMatchingCollectionQuery(t,e,r,i)}getNextDocuments(t,e,r,i){return this.remoteDocumentCache.getAllFromCollectionGroup(t,e,r,i).next(o=>{const u=i-o.size>0?this.documentOverlayCache.getOverlaysForCollectionGroup(t,e,r.largestBatchId,i-o.size):S.resolve(oe());let l=hn,f=o;return u.next(d=>S.forEach(d,(_,v)=>(l<v.largestBatchId&&(l=v.largestBatchId),o.get(_)?S.resolve():this.remoteDocumentCache.getEntry(t,_).next(R=>{f=f.insert(_,R)}))).next(()=>this.populateOverlays(t,d,o)).next(()=>this.computeViews(t,f,d,$())).next(_=>({batchId:l,changes:Lh(_)})))})}getDocumentsMatchingDocumentQuery(t,e){return this.getDocument(t,new k(e)).next(r=>{let i=tn();return r.isFoundDocument()&&(i=i.insert(r.key,r)),i})}getDocumentsMatchingCollectionGroupQuery(t,e,r,i){const o=e.collectionGroup;let u=tn();return this.indexManager.getCollectionParents(t,o).next(l=>S.forEach(l,f=>{const d=function(v,R){return new or(R,null,v.explicitOrderBy.slice(),v.filters.slice(),v.limit,v.limitType,v.startAt,v.endAt)}(e,f.child(o));return this.getDocumentsMatchingCollectionQuery(t,d,r,i).next(_=>{_.forEach((v,R)=>{u=u.insert(v,R)})})}).next(()=>u))}getDocumentsMatchingCollectionQuery(t,e,r,i){let o;return this.documentOverlayCache.getOverlaysForCollection(t,e.path,r.largestBatchId).next(u=>(o=u,this.remoteDocumentCache.getDocumentsMatchingQuery(t,e,r,o,i))).next(u=>{o.forEach((f,d)=>{const _=d.getKey();u.get(_)===null&&(u=u.insert(_,pt.newInvalidDocument(_)))});let l=tn();return u.forEach((f,d)=>{const _=o.get(f);_!==void 0&&an(_.mutation,d,Bt.empty(),et.now()),ur(e,d)&&(l=l.insert(f,d))}),l})}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Vf{constructor(t){this.serializer=t,this.Nr=new Map,this.Br=new Map}getBundleMetadata(t,e){return S.resolve(this.Nr.get(e))}saveBundleMetadata(t,e){return this.Nr.set(e.id,function(i){return{id:i.id,version:i.version,createTime:Te(i.createTime)}}(e)),S.resolve()}getNamedQuery(t,e){return S.resolve(this.Br.get(e))}saveNamedQuery(t,e){return this.Br.set(e.name,function(i){return{name:i.name,query:Ef(i.bundledQuery),readTime:Te(i.readTime)}}(e)),S.resolve()}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Df{constructor(){this.overlays=new Z(k.comparator),this.Lr=new Map}getOverlay(t,e){return S.resolve(this.overlays.get(e))}getOverlays(t,e){const r=oe();return S.forEach(e,i=>this.getOverlay(t,i).next(o=>{o!==null&&r.set(i,o)})).next(()=>r)}saveOverlays(t,e,r){return r.forEach((i,o)=>{this.bt(t,e,o)}),S.resolve()}removeOverlaysForBatchId(t,e,r){const i=this.Lr.get(r);return i!==void 0&&(i.forEach(o=>this.overlays=this.overlays.remove(o)),this.Lr.delete(r)),S.resolve()}getOverlaysForCollection(t,e,r){const i=oe(),o=e.length+1,u=new k(e.child("")),l=this.overlays.getIteratorFrom(u);for(;l.hasNext();){const f=l.getNext().value,d=f.getKey();if(!e.isPrefixOf(d.path))break;d.path.length===o&&f.largestBatchId>r&&i.set(f.getKey(),f)}return S.resolve(i)}getOverlaysForCollectionGroup(t,e,r,i){let o=new Z((d,_)=>d-_);const u=this.overlays.getIterator();for(;u.hasNext();){const d=u.getNext().value;if(d.getKey().getCollectionGroup()===e&&d.largestBatchId>r){let _=o.get(d.largestBatchId);_===null&&(_=oe(),o=o.insert(d.largestBatchId,_)),_.set(d.getKey(),d)}}const l=oe(),f=o.getIterator();for(;f.hasNext()&&(f.getNext().value.forEach((d,_)=>l.set(d,_)),!(l.size()>=i)););return S.resolve(l)}bt(t,e,r){const i=this.overlays.get(r.key);if(i!==null){const u=this.Lr.get(i.largestBatchId).delete(r.key);this.Lr.set(i.largestBatchId,u)}this.overlays=this.overlays.insert(r.key,new Jh(e,r));let o=this.Lr.get(e);o===void 0&&(o=$(),this.Lr.set(e,o)),this.Lr.set(e,o.add(r.key))}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Nf{constructor(){this.sessionToken=ct.EMPTY_BYTE_STRING}getSessionToken(t){return S.resolve(this.sessionToken)}setSessionToken(t,e){return this.sessionToken=e,S.resolve()}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ds{constructor(){this.kr=new it(at.Kr),this.qr=new it(at.Ur)}isEmpty(){return this.kr.isEmpty()}addReference(t,e){const r=new at(t,e);this.kr=this.kr.add(r),this.qr=this.qr.add(r)}$r(t,e){t.forEach(r=>this.addReference(r,e))}removeReference(t,e){this.Wr(new at(t,e))}Qr(t,e){t.forEach(r=>this.removeReference(r,e))}Gr(t){const e=new k(new K([])),r=new at(e,t),i=new at(e,t+1),o=[];return this.qr.forEachInRange([r,i],u=>{this.Wr(u),o.push(u.key)}),o}zr(){this.kr.forEach(t=>this.Wr(t))}Wr(t){this.kr=this.kr.delete(t),this.qr=this.qr.delete(t)}jr(t){const e=new k(new K([])),r=new at(e,t),i=new at(e,t+1);let o=$();return this.qr.forEachInRange([r,i],u=>{o=o.add(u.key)}),o}containsKey(t){const e=new at(t,0),r=this.kr.firstAfterOrEqual(e);return r!==null&&t.isEqual(r.key)}}class at{constructor(t,e){this.key=t,this.Hr=e}static Kr(t,e){return k.comparator(t.key,e.key)||U(t.Hr,e.Hr)}static Ur(t,e){return U(t.Hr,e.Hr)||k.comparator(t.key,e.key)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class kf{constructor(t,e){this.indexManager=t,this.referenceDelegate=e,this.mutationQueue=[],this.Yn=1,this.Jr=new it(at.Kr)}checkEmpty(t){return S.resolve(this.mutationQueue.length===0)}addMutationBatch(t,e,r,i){const o=this.Yn;this.Yn++,this.mutationQueue.length>0&&this.mutationQueue[this.mutationQueue.length-1];const u=new Wh(o,e,r,i);this.mutationQueue.push(u);for(const l of i)this.Jr=this.Jr.add(new at(l.key,o)),this.indexManager.addToCollectionParentIndex(t,l.key.path.popLast());return S.resolve(u)}lookupMutationBatch(t,e){return S.resolve(this.Zr(e))}getNextMutationBatchAfterBatchId(t,e){const r=e+1,i=this.Xr(r),o=i<0?0:i;return S.resolve(this.mutationQueue.length>o?this.mutationQueue[o]:null)}getHighestUnacknowledgedBatchId(){return S.resolve(this.mutationQueue.length===0?uh:this.Yn-1)}getAllMutationBatches(t){return S.resolve(this.mutationQueue.slice())}getAllMutationBatchesAffectingDocumentKey(t,e){const r=new at(e,0),i=new at(e,Number.POSITIVE_INFINITY),o=[];return this.Jr.forEachInRange([r,i],u=>{const l=this.Zr(u.Hr);o.push(l)}),S.resolve(o)}getAllMutationBatchesAffectingDocumentKeys(t,e){let r=new it(U);return e.forEach(i=>{const o=new at(i,0),u=new at(i,Number.POSITIVE_INFINITY);this.Jr.forEachInRange([o,u],l=>{r=r.add(l.Hr)})}),S.resolve(this.Yr(r))}getAllMutationBatchesAffectingQuery(t,e){const r=e.path,i=r.length+1;let o=r;k.isDocumentKey(o)||(o=o.child(""));const u=new at(new k(o),0);let l=new it(U);return this.Jr.forEachWhile(f=>{const d=f.key.path;return!!r.isPrefixOf(d)&&(d.length===i&&(l=l.add(f.Hr)),!0)},u),S.resolve(this.Yr(l))}Yr(t){const e=[];return t.forEach(r=>{const i=this.Zr(r);i!==null&&e.push(i)}),e}removeMutationBatch(t,e){Q(this.ei(e.batchId,"removed")===0,55003),this.mutationQueue.shift();let r=this.Jr;return S.forEach(e.mutations,i=>{const o=new at(i.key,e.batchId);return r=r.delete(o),this.referenceDelegate.markPotentiallyOrphaned(t,i.key)}).next(()=>{this.Jr=r})}nr(t){}containsKey(t,e){const r=new at(e,0),i=this.Jr.firstAfterOrEqual(r);return S.resolve(e.isEqual(i&&i.key))}performConsistencyCheck(t){return this.mutationQueue.length,S.resolve()}ei(t,e){return this.Xr(t)}Xr(t){return this.mutationQueue.length===0?0:t-this.mutationQueue[0].batchId}Zr(t){const e=this.Xr(t);return e<0||e>=this.mutationQueue.length?null:this.mutationQueue[e]}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Of{constructor(t){this.ti=t,this.docs=function(){return new Z(k.comparator)}(),this.size=0}setIndexManager(t){this.indexManager=t}addEntry(t,e){const r=e.key,i=this.docs.get(r),o=i?i.size:0,u=this.ti(e);return this.docs=this.docs.insert(r,{document:e.mutableCopy(),size:u}),this.size+=u-o,this.indexManager.addToCollectionParentIndex(t,r.path.popLast())}removeEntry(t){const e=this.docs.get(t);e&&(this.docs=this.docs.remove(t),this.size-=e.size)}getEntry(t,e){const r=this.docs.get(e);return S.resolve(r?r.document.mutableCopy():pt.newInvalidDocument(e))}getEntries(t,e){let r=Yt();return e.forEach(i=>{const o=this.docs.get(i);r=r.insert(i,o?o.document.mutableCopy():pt.newInvalidDocument(i))}),S.resolve(r)}getDocumentsMatchingQuery(t,e,r,i){let o=Yt();const u=e.path,l=new k(u.child("__id-9223372036854775808__")),f=this.docs.getIteratorFrom(l);for(;f.hasNext();){const{key:d,value:{document:_}}=f.getNext();if(!u.isPrefixOf(d.path))break;d.path.length>u.length+1||sh(rh(_),r)<=0||(i.has(_.key)||ur(e,_))&&(o=o.insert(_.key,_.mutableCopy()))}return S.resolve(o)}getAllFromCollectionGroup(t,e,r,i){M(9500)}ni(t,e){return S.forEach(this.docs,r=>e(r))}newChangeBuffer(t){return new xf(this)}getSize(t){return S.resolve(this.size)}}class xf extends Cf{constructor(t){super(),this.Mr=t}applyChanges(t){const e=[];return this.changes.forEach((r,i)=>{i.isValidDocument()?e.push(this.Mr.addEntry(t,i)):this.Mr.removeEntry(r)}),S.waitFor(e)}getFromCache(t,e){return this.Mr.getEntry(t,e)}getAllFromCache(t,e){return this.Mr.getEntries(t,e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Mf{constructor(t){this.persistence=t,this.ri=new he(e=>Ss(e),Cs),this.lastRemoteSnapshotVersion=x.min(),this.highestTargetId=0,this.ii=0,this.si=new Ds,this.targetCount=0,this.oi=Pe._r()}forEachTarget(t,e){return this.ri.forEach((r,i)=>e(i)),S.resolve()}getLastRemoteSnapshotVersion(t){return S.resolve(this.lastRemoteSnapshotVersion)}getHighestSequenceNumber(t){return S.resolve(this.ii)}allocateTargetId(t){return this.highestTargetId=this.oi.next(),S.resolve(this.highestTargetId)}setTargetsMetadata(t,e,r){return r&&(this.lastRemoteSnapshotVersion=r),e>this.ii&&(this.ii=e),S.resolve()}lr(t){this.ri.set(t.target,t);const e=t.targetId;e>this.highestTargetId&&(this.oi=new Pe(e),this.highestTargetId=e),t.sequenceNumber>this.ii&&(this.ii=t.sequenceNumber)}addTargetData(t,e){return this.lr(e),this.targetCount+=1,S.resolve()}updateTargetData(t,e){return this.lr(e),S.resolve()}removeTargetData(t,e){return this.ri.delete(e.target),this.si.Gr(e.targetId),this.targetCount-=1,S.resolve()}removeTargets(t,e,r){let i=0;const o=[];return this.ri.forEach((u,l)=>{l.sequenceNumber<=e&&r.get(l.targetId)===null&&(this.ri.delete(u),o.push(this.removeMatchingKeysForTargetId(t,l.targetId)),i++)}),S.waitFor(o).next(()=>i)}getTargetCount(t){return S.resolve(this.targetCount)}getTargetData(t,e){const r=this.ri.get(e)||null;return S.resolve(r)}addMatchingKeys(t,e,r){return this.si.$r(e,r),S.resolve()}removeMatchingKeys(t,e,r){this.si.Qr(e,r);const i=this.persistence.referenceDelegate,o=[];return i&&e.forEach(u=>{o.push(i.markPotentiallyOrphaned(t,u))}),S.waitFor(o)}removeMatchingKeysForTargetId(t,e){return this.si.Gr(e),S.resolve()}getMatchingKeysForTargetId(t,e){const r=this.si.jr(e);return S.resolve(r)}containsKey(t,e){return S.resolve(this.si.containsKey(e))}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class eu{constructor(t,e){this._i={},this.overlays={},this.ai=new rr(0),this.ui=!1,this.ui=!0,this.ci=new Nf,this.referenceDelegate=t(this),this.li=new Mf(this),this.indexManager=new Tf,this.remoteDocumentCache=function(i){return new Of(i)}(r=>this.referenceDelegate.hi(r)),this.serializer=new yf(e),this.Pi=new Vf(this.serializer)}start(){return Promise.resolve()}shutdown(){return this.ui=!1,Promise.resolve()}get started(){return this.ui}setDatabaseDeletedListener(){}setNetworkEnabled(){}getIndexManager(t){return this.indexManager}getDocumentOverlayCache(t){let e=this.overlays[t.toKey()];return e||(e=new Df,this.overlays[t.toKey()]=e),e}getMutationQueue(t,e){let r=this._i[t.toKey()];return r||(r=new kf(e,this.referenceDelegate),this._i[t.toKey()]=r),r}getGlobalsCache(){return this.ci}getTargetCache(){return this.li}getRemoteDocumentCache(){return this.remoteDocumentCache}getBundleCache(){return this.Pi}runTransaction(t,e,r){V("MemoryPersistence","Starting transaction:",t);const i=new Lf(this.ai.next());return this.referenceDelegate.Ti(),r(i).next(o=>this.referenceDelegate.Ii(i).next(()=>o)).toPromise().then(o=>(i.raiseOnCommittedEvent(),o))}Ei(t,e){return S.or(Object.values(this._i).map(r=>()=>r.containsKey(t,e)))}}class Lf extends oh{constructor(t){super(),this.currentSequenceNumber=t}}class Ns{constructor(t){this.persistence=t,this.Ri=new Ds,this.Ai=null}static Vi(t){return new Ns(t)}get di(){if(this.Ai)return this.Ai;throw M(60996)}addReference(t,e,r){return this.Ri.addReference(r,e),this.di.delete(r.toString()),S.resolve()}removeReference(t,e,r){return this.Ri.removeReference(r,e),this.di.add(r.toString()),S.resolve()}markPotentiallyOrphaned(t,e){return this.di.add(e.toString()),S.resolve()}removeTarget(t,e){this.Ri.Gr(e.targetId).forEach(i=>this.di.add(i.toString()));const r=this.persistence.getTargetCache();return r.getMatchingKeysForTargetId(t,e.targetId).next(i=>{i.forEach(o=>this.di.add(o.toString()))}).next(()=>r.removeTargetData(t,e))}Ti(){this.Ai=new Set}Ii(t){const e=this.persistence.getRemoteDocumentCache().newChangeBuffer();return S.forEach(this.di,r=>{const i=k.fromPath(r);return this.mi(t,i).next(o=>{o||e.removeEntry(i,x.min())})}).next(()=>(this.Ai=null,e.apply(t)))}updateLimboDocument(t,e){return this.mi(t,e).next(r=>{r?this.di.delete(e.toString()):this.di.add(e.toString())})}hi(t){return 0}mi(t,e){return S.or([()=>S.resolve(this.Ri.containsKey(e)),()=>this.persistence.getTargetCache().containsKey(t,e),()=>this.persistence.Ei(t,e)])}}class tr{constructor(t,e){this.persistence=t,this.fi=new he(r=>ch(r.path),(r,i)=>r.isEqual(i)),this.garbageCollector=Sf(this,e)}static Vi(t,e){return new tr(t,e)}Ti(){}Ii(t){return S.resolve()}forEachTarget(t,e){return this.persistence.getTargetCache().forEachTarget(t,e)}dr(t){const e=this.pr(t);return this.persistence.getTargetCache().getTargetCount(t).next(r=>e.next(i=>r+i))}pr(t){let e=0;return this.mr(t,r=>{e++}).next(()=>e)}mr(t,e){return S.forEach(this.fi,(r,i)=>this.wr(t,r,i).next(o=>o?S.resolve():e(i)))}removeTargets(t,e,r){return this.persistence.getTargetCache().removeTargets(t,e,r)}removeOrphanedDocuments(t,e){let r=0;const i=this.persistence.getRemoteDocumentCache(),o=i.newChangeBuffer();return i.ni(t,u=>this.wr(t,u,e).next(l=>{l||(r++,o.removeEntry(u,x.min()))})).next(()=>o.apply(t)).next(()=>r)}markPotentiallyOrphaned(t,e){return this.fi.set(e,t.currentSequenceNumber),S.resolve()}removeTarget(t,e){const r=e.withSequenceNumber(t.currentSequenceNumber);return this.persistence.getTargetCache().updateTargetData(t,r)}addReference(t,e,r){return this.fi.set(r,t.currentSequenceNumber),S.resolve()}removeReference(t,e,r){return this.fi.set(r,t.currentSequenceNumber),S.resolve()}updateLimboDocument(t,e){return this.fi.set(e,t.currentSequenceNumber),S.resolve()}hi(t){let e=t.key.toString().length;return t.isFoundDocument()&&(e+=qn(t.data.value)),e}wr(t,e,r){return S.or([()=>this.persistence.Ei(t,e),()=>this.persistence.getTargetCache().containsKey(t,e),()=>{const i=this.fi.get(e);return S.resolve(i!==void 0&&i>r)}])}getCacheSize(t){return this.persistence.getRemoteDocumentCache().getSize(t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ks{constructor(t,e,r,i){this.targetId=t,this.fromCache=e,this.Ts=r,this.Is=i}static Es(t,e){let r=$(),i=$();for(const o of e.docChanges)switch(o.type){case 0:r=r.add(o.doc.key);break;case 1:i=i.add(o.doc.key)}return new ks(t,e.fromCache,r,i)}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ff{constructor(){this._documentReadCount=0}get documentReadCount(){return this._documentReadCount}incrementDocumentReadCount(t){this._documentReadCount+=t}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Uf{constructor(){this.Rs=!1,this.As=!1,this.Vs=100,this.ds=function(){return vc()?8:ah(ia())>0?6:4}()}initialize(t,e){this.fs=t,this.indexManager=e,this.Rs=!0}getDocumentsMatchingQuery(t,e,r,i){const o={result:null};return this.gs(t,e).next(u=>{o.result=u}).next(()=>{if(!o.result)return this.ps(t,e,i,r).next(u=>{o.result=u})}).next(()=>{if(o.result)return;const u=new Ff;return this.ys(t,e,u).next(l=>{if(o.result=l,this.As)return this.ws(t,e,u,l.size)})}).next(()=>o.result)}ws(t,e,r,i){return r.documentReadCount<this.Vs?(pe()<=j.DEBUG&&V("QueryEngine","SDK will not create cache indexes for query:",ge(e),"since it only creates cache indexes for collection contains","more than or equal to",this.Vs,"documents"),S.resolve()):(pe()<=j.DEBUG&&V("QueryEngine","Query:",ge(e),"scans",r.documentReadCount,"local documents and returns",i,"documents as results."),r.documentReadCount>this.ds*i?(pe()<=j.DEBUG&&V("QueryEngine","The SDK decides to create cache indexes for query:",ge(e),"as using cache indexes may help improve performance."),this.indexManager.createTargetIndexes(t,Pt(e))):S.resolve())}gs(t,e){if(To(e))return S.resolve(null);let r=Pt(e);return this.indexManager.getIndexType(t,r).next(i=>i===0?null:(e.limit!==null&&i===1&&(e=cs(e,null,"F"),r=Pt(e)),this.indexManager.getDocumentsMatchingTarget(t,r).next(o=>{const u=$(...o);return this.fs.getDocuments(t,u).next(l=>this.indexManager.getMinOffset(t,r).next(f=>{const d=this.bs(e,l);return this.Ss(e,d,u,f.readTime)?this.gs(t,cs(e,null,"F")):this.Ds(t,d,e,f)}))})))}ps(t,e,r,i){return To(e)||i.isEqual(x.min())?S.resolve(null):this.fs.getDocuments(t,r).next(o=>{const u=this.bs(e,o);return this.Ss(e,u,r,i)?S.resolve(null):(pe()<=j.DEBUG&&V("QueryEngine","Re-using previous result from %s to execute query: %s",i.toString(),ge(e)),this.Ds(t,u,e,nh(i,hn)).next(l=>l))})}bs(t,e){let r=new it(La(t));return e.forEach((i,o)=>{ur(t,o)&&(r=r.add(o))}),r}Ss(t,e,r,i){if(t.limit===null)return!1;if(r.size!==e.size)return!0;const o=t.limitType==="F"?e.last():e.first();return!!o&&(o.hasPendingWrites||o.version.compareTo(i)>0)}ys(t,e,r){return pe()<=j.DEBUG&&V("QueryEngine","Using full collection scan to execute query:",ge(e)),this.fs.getDocumentsMatchingQuery(t,e,Kt.min(),r)}Ds(t,e,r,i){return this.fs.getDocumentsMatchingQuery(t,r,i).next(o=>(e.forEach(u=>{o=o.insert(u.key,u)}),o))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Os="LocalStore",Bf=3e8;class jf{constructor(t,e,r,i){this.persistence=t,this.Cs=e,this.serializer=i,this.vs=new Z(U),this.Fs=new he(o=>Ss(o),Cs),this.Ms=new Map,this.xs=t.getRemoteDocumentCache(),this.li=t.getTargetCache(),this.Pi=t.getBundleCache(),this.Os(r)}Os(t){this.documentOverlayCache=this.persistence.getDocumentOverlayCache(t),this.indexManager=this.persistence.getIndexManager(t),this.mutationQueue=this.persistence.getMutationQueue(t,this.indexManager),this.localDocuments=new Pf(this.xs,this.mutationQueue,this.documentOverlayCache,this.indexManager),this.xs.setIndexManager(this.indexManager),this.Cs.initialize(this.localDocuments,this.indexManager)}collectGarbage(t){return this.persistence.runTransaction("Collect garbage","readwrite-primary",e=>t.collect(e,this.vs))}}function qf(n,t,e,r){return new jf(n,t,e,r)}async function nu(n,t){const e=q(n);return await e.persistence.runTransaction("Handle user change","readonly",r=>{let i;return e.mutationQueue.getAllMutationBatches(r).next(o=>(i=o,e.Os(t),e.mutationQueue.getAllMutationBatches(r))).next(o=>{const u=[],l=[];let f=$();for(const d of i){u.push(d.batchId);for(const _ of d.mutations)f=f.add(_.key)}for(const d of o){l.push(d.batchId);for(const _ of d.mutations)f=f.add(_.key)}return e.localDocuments.getDocuments(r,f).next(d=>({Ns:d,removedBatchIds:u,addedBatchIds:l}))})})}function ru(n){const t=q(n);return t.persistence.runTransaction("Get last remote snapshot version","readonly",e=>t.li.getLastRemoteSnapshotVersion(e))}function $f(n,t){const e=q(n),r=t.snapshotVersion;let i=e.vs;return e.persistence.runTransaction("Apply remote event","readwrite-primary",o=>{const u=e.xs.newChangeBuffer({trackRemovals:!0});i=e.vs;const l=[];t.targetChanges.forEach((_,v)=>{const R=i.get(v);if(!R)return;l.push(e.li.removeMatchingKeys(o,_.removedDocuments,v).next(()=>e.li.addMatchingKeys(o,_.addedDocuments,v)));let C=R.withSequenceNumber(o.currentSequenceNumber);t.targetMismatches.get(v)!==null?C=C.withResumeToken(ct.EMPTY_BYTE_STRING,x.min()).withLastLimboFreeSnapshotVersion(x.min()):_.resumeToken.approximateByteSize()>0&&(C=C.withResumeToken(_.resumeToken,r)),i=i.insert(v,C),function(L,N,W){return L.resumeToken.approximateByteSize()===0||N.snapshotVersion.toMicroseconds()-L.snapshotVersion.toMicroseconds()>=Bf?!0:W.addedDocuments.size+W.modifiedDocuments.size+W.removedDocuments.size>0}(R,C,_)&&l.push(e.li.updateTargetData(o,C))});let f=Yt(),d=$();if(t.documentUpdates.forEach(_=>{t.resolvedLimboDocuments.has(_)&&l.push(e.persistence.referenceDelegate.updateLimboDocument(o,_))}),l.push(zf(o,u,t.documentUpdates).next(_=>{f=_.Bs,d=_.Ls})),!r.isEqual(x.min())){const _=e.li.getLastRemoteSnapshotVersion(o).next(v=>e.li.setTargetsMetadata(o,o.currentSequenceNumber,r));l.push(_)}return S.waitFor(l).next(()=>u.apply(o)).next(()=>e.localDocuments.getLocalViewOfDocuments(o,f,d)).next(()=>f)}).then(o=>(e.vs=i,o))}function zf(n,t,e){let r=$(),i=$();return e.forEach(o=>r=r.add(o)),t.getEntries(n,r).next(o=>{let u=Yt();return e.forEach((l,f)=>{const d=o.get(l);f.isFoundDocument()!==d.isFoundDocument()&&(i=i.add(l)),f.isNoDocument()&&f.version.isEqual(x.min())?(t.removeEntry(l,f.readTime),u=u.insert(l,f)):!d.isValidDocument()||f.version.compareTo(d.version)>0||f.version.compareTo(d.version)===0&&d.hasPendingWrites?(t.addEntry(f),u=u.insert(l,f)):V(Os,"Ignoring outdated watch update for ",l,". Current version:",d.version," Watch version:",f.version)}),{Bs:u,Ls:i}})}function Hf(n,t){const e=q(n);return e.persistence.runTransaction("Allocate target","readwrite",r=>{let i;return e.li.getTargetData(r,t).next(o=>o?(i=o,S.resolve(i)):e.li.allocateTargetId(r).next(u=>(i=new jt(t,u,"TargetPurposeListen",r.currentSequenceNumber),e.li.addTargetData(r,i).next(()=>i))))}).then(r=>{const i=e.vs.get(r.targetId);return(i===null||r.snapshotVersion.compareTo(i.snapshotVersion)>0)&&(e.vs=e.vs.insert(r.targetId,r),e.Fs.set(t,r.targetId)),r})}async function ms(n,t,e){const r=q(n),i=r.vs.get(t),o=e?"readwrite":"readwrite-primary";try{e||await r.persistence.runTransaction("Release target",o,u=>r.persistence.referenceDelegate.removeTarget(u,i))}catch(u){if(!Oe(u))throw u;V(Os,`Failed to update sequence numbers for target ${t}: ${u}`)}r.vs=r.vs.remove(t),r.Fs.delete(i.target)}function ko(n,t,e){const r=q(n);let i=x.min(),o=$();return r.persistence.runTransaction("Execute query","readwrite",u=>function(f,d,_){const v=q(f),R=v.Fs.get(_);return R!==void 0?S.resolve(v.vs.get(R)):v.li.getTargetData(d,_)}(r,u,Pt(t)).next(l=>{if(l)return i=l.lastLimboFreeSnapshotVersion,r.li.getMatchingKeysForTargetId(u,l.targetId).next(f=>{o=f})}).next(()=>r.Cs.getDocumentsMatchingQuery(u,t,e?i:x.min(),e?o:$())).next(l=>(Gf(r,Oh(t),l),{documents:l,ks:o})))}function Gf(n,t,e){let r=n.Ms.get(t)||x.min();e.forEach((i,o)=>{o.readTime.compareTo(r)>0&&(r=o.readTime)}),n.Ms.set(t,r)}class Oo{constructor(){this.activeTargetIds=Bh()}Qs(t){this.activeTargetIds=this.activeTargetIds.add(t)}Gs(t){this.activeTargetIds=this.activeTargetIds.delete(t)}Ws(){const t={activeTargetIds:this.activeTargetIds.toArray(),updateTimeMs:Date.now()};return JSON.stringify(t)}}class Kf{constructor(){this.vo=new Oo,this.Fo={},this.onlineStateHandler=null,this.sequenceNumberHandler=null}addPendingMutation(t){}updateMutationState(t,e,r){}addLocalQueryTarget(t,e=!0){return e&&this.vo.Qs(t),this.Fo[t]||"not-current"}updateQueryState(t,e,r){this.Fo[t]=e}removeLocalQueryTarget(t){this.vo.Gs(t)}isLocalQueryTarget(t){return this.vo.activeTargetIds.has(t)}clearQueryState(t){delete this.Fo[t]}getAllActiveQueryTargets(){return this.vo.activeTargetIds}isActiveQueryTarget(t){return this.vo.activeTargetIds.has(t)}start(){return this.vo=new Oo,Promise.resolve()}handleUserChange(t,e,r){}setOnlineState(t){}shutdown(){}writeSequenceNumber(t){}notifyBundleLoaded(t){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Qf{Mo(t){}shutdown(){}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const xo="ConnectivityMonitor";class Mo{constructor(){this.xo=()=>this.Oo(),this.No=()=>this.Bo(),this.Lo=[],this.ko()}Mo(t){this.Lo.push(t)}shutdown(){window.removeEventListener("online",this.xo),window.removeEventListener("offline",this.No)}ko(){window.addEventListener("online",this.xo),window.addEventListener("offline",this.No)}Oo(){V(xo,"Network connectivity changed: AVAILABLE");for(const t of this.Lo)t(0)}Bo(){V(xo,"Network connectivity changed: UNAVAILABLE");for(const t of this.Lo)t(1)}static v(){return typeof window<"u"&&window.addEventListener!==void 0&&window.removeEventListener!==void 0}}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */let Un=null;function ps(){return Un===null?Un=function(){return 268435456+Math.round(2147483648*Math.random())}():Un++,"0x"+Un.toString(16)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Hr="RestConnection",Wf={BatchGetDocuments:"batchGet",Commit:"commit",RunQuery:"runQuery",RunAggregationQuery:"runAggregationQuery",ExecutePipeline:"executePipeline"};class Jf{get Ko(){return!1}constructor(t){this.databaseInfo=t,this.databaseId=t.databaseId;const e=t.ssl?"https":"http",r=encodeURIComponent(this.databaseId.projectId),i=encodeURIComponent(this.databaseId.database);this.qo=e+"://"+t.host,this.Uo=`projects/${r}/databases/${i}`,this.$o=this.databaseId.database===Wn?`project_id=${r}`:`project_id=${r}&database_id=${i}`}Wo(t,e,r,i,o){const u=ps(),l=this.Qo(t,e.toUriEncodedString());V(Hr,`Sending RPC '${t}' ${u}:`,l,r);const f={"google-cloud-resource-prefix":this.Uo,"x-goog-request-params":this.$o};this.Go(f,i,o);const{host:d}=new URL(l),_=vs(d);return this.zo(t,l,f,r,_).then(v=>(V(Hr,`Received RPC '${t}' ${u}: `,v),v),v=>{throw le(Hr,`RPC '${t}' ${u} failed with error: `,v,"url: ",l,"request:",r),v})}jo(t,e,r,i,o,u){return this.Wo(t,e,r,i,o)}Go(t,e,r){t["X-Goog-Api-Client"]=function(){return"gl-js/ fire/"+ke}(),t["Content-Type"]="text/plain",this.databaseInfo.appId&&(t["X-Firebase-GMPID"]=this.databaseInfo.appId),e&&e.headers.forEach((i,o)=>t[o]=i),r&&r.headers.forEach((i,o)=>t[o]=i)}Qo(t,e){const r=Wf[t];let i=`${this.qo}/v1/${e}:${r}`;return this.databaseInfo.apiKey&&(i=`${i}?key=${encodeURIComponent(this.databaseInfo.apiKey)}`),i}terminate(){}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Yf{constructor(t){this.Ho=t.Ho,this.Jo=t.Jo}Zo(t){this.Xo=t}Yo(t){this.e_=t}t_(t){this.n_=t}onMessage(t){this.r_=t}close(){this.Jo()}send(t){this.Ho(t)}i_(){this.Xo()}s_(){this.e_()}o_(t){this.n_(t)}__(t){this.r_(t)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dt="WebChannelConnection",Xe=(n,t,e)=>{n.listen(t,r=>{try{e(r)}catch(i){setTimeout(()=>{throw i},0)}})};class ve extends Jf{constructor(t){super(t),this.a_=[],this.forceLongPolling=t.forceLongPolling,this.autoDetectLongPolling=t.autoDetectLongPolling,this.useFetchStreams=t.useFetchStreams,this.longPollingOptions=t.longPollingOptions}static u_(){if(!ve.c_){const t=ya();Xe(t,_a.STAT_EVENT,e=>{e.stat===ts.PROXY?V(dt,"STAT_EVENT: detected buffering proxy"):e.stat===ts.NOPROXY&&V(dt,"STAT_EVENT: detected no buffering proxy")}),ve.c_=!0}}zo(t,e,r,i,o){const u=ps();return new Promise((l,f)=>{const d=new pa;d.setWithCredentials(!0),d.listenOnce(ga.COMPLETE,()=>{try{switch(d.getLastErrorCode()){case jn.NO_ERROR:const v=d.getResponseJson();V(dt,`XHR for RPC '${t}' ${u} received:`,JSON.stringify(v)),l(v);break;case jn.TIMEOUT:V(dt,`RPC '${t}' ${u} timed out`),f(new D(P.DEADLINE_EXCEEDED,"Request time out"));break;case jn.HTTP_ERROR:const R=d.getStatus();if(V(dt,`RPC '${t}' ${u} failed with status:`,R,"response text:",d.getResponseText()),R>0){let C=d.getResponseJson();Array.isArray(C)&&(C=C[0]);const O=C==null?void 0:C.error;if(O&&O.status&&O.message){const L=function(W){const H=W.toLowerCase().replace(/_/g,"-");return Object.values(P).indexOf(H)>=0?H:P.UNKNOWN}(O.status);f(new D(L,O.message))}else f(new D(P.UNKNOWN,"Server responded with status "+d.getStatus()))}else f(new D(P.UNAVAILABLE,"Connection failed."));break;default:M(9055,{l_:t,streamId:u,h_:d.getLastErrorCode(),P_:d.getLastError()})}}finally{V(dt,`RPC '${t}' ${u} completed.`)}});const _=JSON.stringify(i);V(dt,`RPC '${t}' ${u} sending request:`,i),d.send(e,"POST",_,r,15)})}T_(t,e,r){const i=ps(),o=[this.qo,"/","google.firestore.v1.Firestore","/",t,"/channel"],u=this.createWebChannelTransport(),l={httpSessionIdParam:"gsessionid",initMessageHeaders:{},messageUrlParams:{database:`projects/${this.databaseId.projectId}/databases/${this.databaseId.database}`},sendRawJson:!0,supportsCrossDomainXhr:!0,internalChannelParams:{forwardChannelRequestTimeoutMs:6e5},forceLongPolling:this.forceLongPolling,detectBufferingProxy:this.autoDetectLongPolling},f=this.longPollingOptions.timeoutSeconds;f!==void 0&&(l.longPollingTimeout=Math.round(1e3*f)),this.useFetchStreams&&(l.useFetchStreams=!0),this.Go(l.initMessageHeaders,e,r),l.encodeInitMessageHeaders=!0;const d=o.join("");V(dt,`Creating RPC '${t}' stream ${i}: ${d}`,l);const _=u.createWebChannel(d,l);this.I_(_);let v=!1,R=!1;const C=new Yf({Ho:O=>{R?V(dt,`Not sending because RPC '${t}' stream ${i} is closed:`,O):(v||(V(dt,`Opening RPC '${t}' stream ${i} transport.`),_.open(),v=!0),V(dt,`RPC '${t}' stream ${i} sending:`,O),_.send(O))},Jo:()=>_.close()});return Xe(_,Ze.EventType.OPEN,()=>{R||(V(dt,`RPC '${t}' stream ${i} transport opened.`),C.i_())}),Xe(_,Ze.EventType.CLOSE,()=>{R||(R=!0,V(dt,`RPC '${t}' stream ${i} transport closed`),C.o_(),this.E_(_))}),Xe(_,Ze.EventType.ERROR,O=>{R||(R=!0,le(dt,`RPC '${t}' stream ${i} transport errored. Name:`,O.name,"Message:",O.message),C.o_(new D(P.UNAVAILABLE,"The operation could not be completed")))}),Xe(_,Ze.EventType.MESSAGE,O=>{var L;if(!R){const N=O.data[0];Q(!!N,16349);const W=N,H=(W==null?void 0:W.error)||((L=W[0])==null?void 0:L.error);if(H){V(dt,`RPC '${t}' stream ${i} received error:`,H);const J=H.status;let Et=function(E){const m=tt[E];if(m!==void 0)return Ha(m)}(J),lt=H.message;J==="NOT_FOUND"&&lt.includes("database")&&lt.includes("does not exist")&&lt.includes(this.databaseId.database)&&le(`Database '${this.databaseId.database}' not found. Please check your project configuration.`),Et===void 0&&(Et=P.INTERNAL,lt="Unknown error status: "+J+" with message "+H.message),R=!0,C.o_(new D(Et,lt)),_.close()}else V(dt,`RPC '${t}' stream ${i} received:`,N),C.__(N)}}),ve.u_(),setTimeout(()=>{C.s_()},0),C}terminate(){this.a_.forEach(t=>t.close()),this.a_=[]}I_(t){this.a_.push(t)}E_(t){this.a_=this.a_.filter(e=>e===t)}Go(t,e,r){super.Go(t,e,r),this.databaseInfo.apiKey&&(t["x-goog-api-key"]=this.databaseInfo.apiKey)}createWebChannelTransport(){return Ea()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Xf(n){return new ve(n)}function Gr(){return typeof document<"u"?document:null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function su(n){return new sf(n,!0)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */ve.c_=!1;class iu{constructor(t,e,r=1e3,i=1.5,o=6e4){this.Ci=t,this.timerId=e,this.R_=r,this.A_=i,this.V_=o,this.d_=0,this.m_=null,this.f_=Date.now(),this.reset()}reset(){this.d_=0}g_(){this.d_=this.V_}p_(t){this.cancel();const e=Math.floor(this.d_+this.y_()),r=Math.max(0,Date.now()-this.f_),i=Math.max(0,e-r);i>0&&V("ExponentialBackoff",`Backing off for ${i} ms (base delay: ${this.d_} ms, delay with jitter: ${e} ms, last attempt: ${r} ms ago)`),this.m_=this.Ci.enqueueAfterDelay(this.timerId,i,()=>(this.f_=Date.now(),t())),this.d_*=this.A_,this.d_<this.R_&&(this.d_=this.R_),this.d_>this.V_&&(this.d_=this.V_)}w_(){this.m_!==null&&(this.m_.skipDelay(),this.m_=null)}cancel(){this.m_!==null&&(this.m_.cancel(),this.m_=null)}y_(){return(Math.random()-.5)*this.d_}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Lo="PersistentStream";class Zf{constructor(t,e,r,i,o,u,l,f){this.Ci=t,this.b_=r,this.S_=i,this.connection=o,this.authCredentialsProvider=u,this.appCheckCredentialsProvider=l,this.listener=f,this.state=0,this.D_=0,this.C_=null,this.v_=null,this.stream=null,this.F_=0,this.M_=new iu(t,e)}x_(){return this.state===1||this.state===5||this.O_()}O_(){return this.state===2||this.state===3}start(){this.F_=0,this.state!==4?this.auth():this.N_()}async stop(){this.x_()&&await this.close(0)}B_(){this.state=0,this.M_.reset()}L_(){this.O_()&&this.C_===null&&(this.C_=this.Ci.enqueueAfterDelay(this.b_,6e4,()=>this.k_()))}K_(t){this.q_(),this.stream.send(t)}async k_(){if(this.O_())return this.close(0)}q_(){this.C_&&(this.C_.cancel(),this.C_=null)}U_(){this.v_&&(this.v_.cancel(),this.v_=null)}async close(t,e){this.q_(),this.U_(),this.M_.cancel(),this.D_++,t!==4?this.M_.reset():e&&e.code===P.RESOURCE_EXHAUSTED?(kt(e.toString()),kt("Using maximum backoff delay to prevent overloading the backend."),this.M_.g_()):e&&e.code===P.UNAUTHENTICATED&&this.state!==3&&(this.authCredentialsProvider.invalidateToken(),this.appCheckCredentialsProvider.invalidateToken()),this.stream!==null&&(this.W_(),this.stream.close(),this.stream=null),this.state=t,await this.listener.t_(e)}W_(){}auth(){this.state=1;const t=this.Q_(this.D_),e=this.D_;Promise.all([this.authCredentialsProvider.getToken(),this.appCheckCredentialsProvider.getToken()]).then(([r,i])=>{this.D_===e&&this.G_(r,i)},r=>{t(()=>{const i=new D(P.UNKNOWN,"Fetching auth token failed: "+r.message);return this.z_(i)})})}G_(t,e){const r=this.Q_(this.D_);this.stream=this.j_(t,e),this.stream.Zo(()=>{r(()=>this.listener.Zo())}),this.stream.Yo(()=>{r(()=>(this.state=2,this.v_=this.Ci.enqueueAfterDelay(this.S_,1e4,()=>(this.O_()&&(this.state=3),Promise.resolve())),this.listener.Yo()))}),this.stream.t_(i=>{r(()=>this.z_(i))}),this.stream.onMessage(i=>{r(()=>++this.F_==1?this.H_(i):this.onNext(i))})}N_(){this.state=5,this.M_.p_(async()=>{this.state=0,this.start()})}z_(t){return V(Lo,`close with error: ${t}`),this.stream=null,this.close(4,t)}Q_(t){return e=>{this.Ci.enqueueAndForget(()=>this.D_===t?e():(V(Lo,"stream callback skipped by getCloseGuardedDispatcher."),Promise.resolve()))}}}class td extends Zf{constructor(t,e,r,i,o,u){super(t,"listen_stream_connection_backoff","listen_stream_idle","health_check_timeout",e,r,i,u),this.serializer=o}j_(t,e){return this.connection.T_("Listen",t,e)}H_(t){return this.onNext(t)}onNext(t){this.M_.reset();const e=lf(this.serializer,t),r=function(o){if(!("targetChange"in o))return x.min();const u=o.targetChange;return u.targetIds&&u.targetIds.length?x.min():u.readTime?Te(u.readTime):x.min()}(t);return this.listener.J_(e,r)}Z_(t){const e={};e.database=Po(this.serializer),e.addTarget=function(o,u){let l;const f=u.target;if(l=us(f)?{documents:hf(o,f)}:{query:ff(o,f).ft},l.targetId=u.targetId,u.resumeToken.approximateByteSize()>0){l.resumeToken=af(o,u.resumeToken);const d=fs(o,u.expectedCount);d!==null&&(l.expectedCount=d)}else if(u.snapshotVersion.compareTo(x.min())>0){l.readTime=of(o,u.snapshotVersion.toTimestamp());const d=fs(o,u.expectedCount);d!==null&&(l.expectedCount=d)}return l}(this.serializer,t);const r=mf(this.serializer,t);r&&(e.labels=r),this.K_(e)}X_(t){const e={};e.database=Po(this.serializer),e.removeTarget=t,this.K_(e)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class ed{}class nd extends ed{constructor(t,e,r,i){super(),this.authCredentials=t,this.appCheckCredentials=e,this.connection=r,this.serializer=i,this.ia=!1}sa(){if(this.ia)throw new D(P.FAILED_PRECONDITION,"The client has already been terminated.")}Wo(t,e,r,i){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([o,u])=>this.connection.Wo(t,ds(e,r),i,o,u)).catch(o=>{throw o.name==="FirebaseError"?(o.code===P.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),o):new D(P.UNKNOWN,o.toString())})}jo(t,e,r,i,o){return this.sa(),Promise.all([this.authCredentials.getToken(),this.appCheckCredentials.getToken()]).then(([u,l])=>this.connection.jo(t,ds(e,r),i,u,l,o)).catch(u=>{throw u.name==="FirebaseError"?(u.code===P.UNAUTHENTICATED&&(this.authCredentials.invalidateToken(),this.appCheckCredentials.invalidateToken()),u):new D(P.UNKNOWN,u.toString())})}terminate(){this.ia=!0,this.connection.terminate()}}function rd(n,t,e,r){return new nd(n,t,e,r)}class sd{constructor(t,e){this.asyncQueue=t,this.onlineStateHandler=e,this.state="Unknown",this.oa=0,this._a=null,this.aa=!0}ua(){this.oa===0&&(this.ca("Unknown"),this._a=this.asyncQueue.enqueueAfterDelay("online_state_timeout",1e4,()=>(this._a=null,this.la("Backend didn't respond within 10 seconds."),this.ca("Offline"),Promise.resolve())))}ha(t){this.state==="Online"?this.ca("Unknown"):(this.oa++,this.oa>=1&&(this.Pa(),this.la(`Connection failed 1 times. Most recent error: ${t.toString()}`),this.ca("Offline")))}set(t){this.Pa(),this.oa=0,t==="Online"&&(this.aa=!1),this.ca(t)}ca(t){t!==this.state&&(this.state=t,this.onlineStateHandler(t))}la(t){const e=`Could not reach Cloud Firestore backend. ${t}
This typically indicates that your device does not have a healthy Internet connection at the moment. The client will operate in offline mode until it is able to successfully connect to the backend.`;this.aa?(kt(e),this.aa=!1):V("OnlineStateTracker",e)}Pa(){this._a!==null&&(this._a.cancel(),this._a=null)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ve="RemoteStore";class id{constructor(t,e,r,i,o){this.localStore=t,this.datastore=e,this.asyncQueue=r,this.remoteSyncer={},this.Ta=[],this.Ia=new Map,this.Ea=new Set,this.Ra=[],this.Aa=o,this.Aa.Mo(u=>{r.enqueueAndForget(async()=>{En(this)&&(V(Ve,"Restarting streams for network reachability change."),await async function(f){const d=q(f);d.Ea.add(4),await yn(d),d.Va.set("Unknown"),d.Ea.delete(4),await fr(d)}(this))})}),this.Va=new sd(r,i)}}async function fr(n){if(En(n))for(const t of n.Ra)await t(!0)}async function yn(n){for(const t of n.Ra)await t(!1)}function ou(n,t){const e=q(n);e.Ia.has(t.targetId)||(e.Ia.set(t.targetId,t),Fs(e)?Ls(e):xe(e).O_()&&Ms(e,t))}function xs(n,t){const e=q(n),r=xe(e);e.Ia.delete(t),r.O_()&&au(e,t),e.Ia.size===0&&(r.O_()?r.L_():En(e)&&e.Va.set("Unknown"))}function Ms(n,t){if(n.da.$e(t.targetId),t.resumeToken.approximateByteSize()>0||t.snapshotVersion.compareTo(x.min())>0){const e=n.remoteSyncer.getRemoteKeysForTarget(t.targetId).size;t=t.withExpectedCount(e)}xe(n).Z_(t)}function au(n,t){n.da.$e(t),xe(n).X_(t)}function Ls(n){n.da=new tf({getRemoteKeysForTarget:t=>n.remoteSyncer.getRemoteKeysForTarget(t),At:t=>n.Ia.get(t)||null,ht:()=>n.datastore.serializer.databaseId}),xe(n).start(),n.Va.ua()}function Fs(n){return En(n)&&!xe(n).x_()&&n.Ia.size>0}function En(n){return q(n).Ea.size===0}function uu(n){n.da=void 0}async function od(n){n.Va.set("Online")}async function ad(n){n.Ia.forEach((t,e)=>{Ms(n,t)})}async function ud(n,t){uu(n),Fs(n)?(n.Va.ha(t),Ls(n)):n.Va.set("Unknown")}async function cd(n,t,e){if(n.Va.set("Online"),t instanceof Ka&&t.state===2&&t.cause)try{await async function(i,o){const u=o.cause;for(const l of o.targetIds)i.Ia.has(l)&&(await i.remoteSyncer.rejectListen(l,u),i.Ia.delete(l),i.da.removeTarget(l))}(n,t)}catch(r){V(Ve,"Failed to remove targets %s: %s ",t.targetIds.join(","),r),await Fo(n,r)}else if(t instanceof zn?n.da.Xe(t):t instanceof Ga?n.da.st(t):n.da.tt(t),!e.isEqual(x.min()))try{const r=await ru(n.localStore);e.compareTo(r)>=0&&await function(o,u){const l=o.da.Tt(u);return l.targetChanges.forEach((f,d)=>{if(f.resumeToken.approximateByteSize()>0){const _=o.Ia.get(d);_&&o.Ia.set(d,_.withResumeToken(f.resumeToken,u))}}),l.targetMismatches.forEach((f,d)=>{const _=o.Ia.get(f);if(!_)return;o.Ia.set(f,_.withResumeToken(ct.EMPTY_BYTE_STRING,_.snapshotVersion)),au(o,f);const v=new jt(_.target,f,d,_.sequenceNumber);Ms(o,v)}),o.remoteSyncer.applyRemoteEvent(l)}(n,e)}catch(r){V(Ve,"Failed to raise snapshot:",r),await Fo(n,r)}}async function Fo(n,t,e){if(!Oe(t))throw t;n.Ea.add(1),await yn(n),n.Va.set("Offline"),e||(e=()=>ru(n.localStore)),n.asyncQueue.enqueueRetryable(async()=>{V(Ve,"Retrying IndexedDB access"),await e(),n.Ea.delete(1),await fr(n)})}async function Uo(n,t){const e=q(n);e.asyncQueue.verifyOperationInProgress(),V(Ve,"RemoteStore received new credentials");const r=En(e);e.Ea.add(3),await yn(e),r&&e.Va.set("Unknown"),await e.remoteSyncer.handleCredentialChange(t),e.Ea.delete(3),await fr(e)}async function ld(n,t){const e=q(n);t?(e.Ea.delete(2),await fr(e)):t||(e.Ea.add(2),await yn(e),e.Va.set("Unknown"))}function xe(n){return n.ma||(n.ma=function(e,r,i){const o=q(e);return o.sa(),new td(r,o.connection,o.authCredentials,o.appCheckCredentials,o.serializer,i)}(n.datastore,n.asyncQueue,{Zo:od.bind(null,n),Yo:ad.bind(null,n),t_:ud.bind(null,n),J_:cd.bind(null,n)}),n.Ra.push(async t=>{t?(n.ma.B_(),Fs(n)?Ls(n):n.Va.set("Unknown")):(await n.ma.stop(),uu(n))})),n.ma}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Us{constructor(t,e,r,i,o){this.asyncQueue=t,this.timerId=e,this.targetTimeMs=r,this.op=i,this.removalCallback=o,this.deferred=new ae,this.then=this.deferred.promise.then.bind(this.deferred.promise),this.deferred.promise.catch(u=>{})}get promise(){return this.deferred.promise}static createAndSchedule(t,e,r,i,o){const u=Date.now()+r,l=new Us(t,e,u,i,o);return l.start(r),l}start(t){this.timerHandle=setTimeout(()=>this.handleDelayElapsed(),t)}skipDelay(){return this.handleDelayElapsed()}cancel(t){this.timerHandle!==null&&(this.clearTimeout(),this.deferred.reject(new D(P.CANCELLED,"Operation cancelled"+(t?": "+t:""))))}handleDelayElapsed(){this.asyncQueue.enqueueAndForget(()=>this.timerHandle!==null?(this.clearTimeout(),this.op().then(t=>this.deferred.resolve(t))):Promise.resolve())}clearTimeout(){this.timerHandle!==null&&(this.removalCallback(this),clearTimeout(this.timerHandle),this.timerHandle=null)}}function cu(n,t){if(kt("AsyncQueue",`${t}: ${n}`),Oe(n))return new D(P.UNAVAILABLE,`${t}: ${n}`);throw n}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ie{static emptySet(t){return new Ie(t.comparator)}constructor(t){this.comparator=t?(e,r)=>t(e,r)||k.comparator(e.key,r.key):(e,r)=>k.comparator(e.key,r.key),this.keyedMap=tn(),this.sortedSet=new Z(this.comparator)}has(t){return this.keyedMap.get(t)!=null}get(t){return this.keyedMap.get(t)}first(){return this.sortedSet.minKey()}last(){return this.sortedSet.maxKey()}isEmpty(){return this.sortedSet.isEmpty()}indexOf(t){const e=this.keyedMap.get(t);return e?this.sortedSet.indexOf(e):-1}get size(){return this.sortedSet.size}forEach(t){this.sortedSet.inorderTraversal((e,r)=>(t(e),!1))}add(t){const e=this.delete(t.key);return e.copy(e.keyedMap.insert(t.key,t),e.sortedSet.insert(t,null))}delete(t){const e=this.get(t);return e?this.copy(this.keyedMap.remove(t),this.sortedSet.remove(e)):this}isEqual(t){if(!(t instanceof Ie)||this.size!==t.size)return!1;const e=this.sortedSet.getIterator(),r=t.sortedSet.getIterator();for(;e.hasNext();){const i=e.getNext().key,o=r.getNext().key;if(!i.isEqual(o))return!1}return!0}toString(){const t=[];return this.forEach(e=>{t.push(e.toString())}),t.length===0?"DocumentSet ()":`DocumentSet (
  `+t.join(`  
`)+`
)`}copy(t,e){const r=new Ie;return r.comparator=this.comparator,r.keyedMap=t,r.sortedSet=e,r}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Bo{constructor(){this.ga=new Z(k.comparator)}track(t){const e=t.doc.key,r=this.ga.get(e);r?t.type!==0&&r.type===3?this.ga=this.ga.insert(e,t):t.type===3&&r.type!==1?this.ga=this.ga.insert(e,{type:r.type,doc:t.doc}):t.type===2&&r.type===2?this.ga=this.ga.insert(e,{type:2,doc:t.doc}):t.type===2&&r.type===0?this.ga=this.ga.insert(e,{type:0,doc:t.doc}):t.type===1&&r.type===0?this.ga=this.ga.remove(e):t.type===1&&r.type===2?this.ga=this.ga.insert(e,{type:1,doc:r.doc}):t.type===0&&r.type===1?this.ga=this.ga.insert(e,{type:2,doc:t.doc}):M(63341,{Vt:t,pa:r}):this.ga=this.ga.insert(e,t)}ya(){const t=[];return this.ga.inorderTraversal((e,r)=>{t.push(r)}),t}}class De{constructor(t,e,r,i,o,u,l,f,d){this.query=t,this.docs=e,this.oldDocs=r,this.docChanges=i,this.mutatedKeys=o,this.fromCache=u,this.syncStateChanged=l,this.excludesMetadataChanges=f,this.hasCachedResults=d}static fromInitialDocuments(t,e,r,i,o){const u=[];return e.forEach(l=>{u.push({type:0,doc:l})}),new De(t,e,Ie.emptySet(e),u,r,i,!0,!1,o)}get hasPendingWrites(){return!this.mutatedKeys.isEmpty()}isEqual(t){if(!(this.fromCache===t.fromCache&&this.hasCachedResults===t.hasCachedResults&&this.syncStateChanged===t.syncStateChanged&&this.mutatedKeys.isEqual(t.mutatedKeys)&&ar(this.query,t.query)&&this.docs.isEqual(t.docs)&&this.oldDocs.isEqual(t.oldDocs)))return!1;const e=this.docChanges,r=t.docChanges;if(e.length!==r.length)return!1;for(let i=0;i<e.length;i++)if(e[i].type!==r[i].type||!e[i].doc.isEqual(r[i].doc))return!1;return!0}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class hd{constructor(){this.wa=void 0,this.ba=[]}Sa(){return this.ba.some(t=>t.Da())}}class fd{constructor(){this.queries=jo(),this.onlineState="Unknown",this.Ca=new Set}terminate(){(function(e,r){const i=q(e),o=i.queries;i.queries=jo(),o.forEach((u,l)=>{for(const f of l.ba)f.onError(r)})})(this,new D(P.ABORTED,"Firestore shutting down"))}}function jo(){return new he(n=>Ma(n),ar)}async function dd(n,t){const e=q(n);let r=3;const i=t.query;let o=e.queries.get(i);o?!o.Sa()&&t.Da()&&(r=2):(o=new hd,r=t.Da()?0:1);try{switch(r){case 0:o.wa=await e.onListen(i,!0);break;case 1:o.wa=await e.onListen(i,!1);break;case 2:await e.onFirstRemoteStoreListen(i)}}catch(u){const l=cu(u,`Initialization of query '${ge(t.query)}' failed`);return void t.onError(l)}e.queries.set(i,o),o.ba.push(t),t.va(e.onlineState),o.wa&&t.Fa(o.wa)&&Bs(e)}async function md(n,t){const e=q(n),r=t.query;let i=3;const o=e.queries.get(r);if(o){const u=o.ba.indexOf(t);u>=0&&(o.ba.splice(u,1),o.ba.length===0?i=t.Da()?0:1:!o.Sa()&&t.Da()&&(i=2))}switch(i){case 0:return e.queries.delete(r),e.onUnlisten(r,!0);case 1:return e.queries.delete(r),e.onUnlisten(r,!1);case 2:return e.onLastRemoteStoreUnlisten(r);default:return}}function pd(n,t){const e=q(n);let r=!1;for(const i of t){const o=i.query,u=e.queries.get(o);if(u){for(const l of u.ba)l.Fa(i)&&(r=!0);u.wa=i}}r&&Bs(e)}function gd(n,t,e){const r=q(n),i=r.queries.get(t);if(i)for(const o of i.ba)o.onError(e);r.queries.delete(t)}function Bs(n){n.Ca.forEach(t=>{t.next()})}var gs,qo;(qo=gs||(gs={})).Ma="default",qo.Cache="cache";class _d{constructor(t,e,r){this.query=t,this.xa=e,this.Oa=!1,this.Na=null,this.onlineState="Unknown",this.options=r||{}}Fa(t){if(!this.options.includeMetadataChanges){const r=[];for(const i of t.docChanges)i.type!==3&&r.push(i);t=new De(t.query,t.docs,t.oldDocs,r,t.mutatedKeys,t.fromCache,t.syncStateChanged,!0,t.hasCachedResults)}let e=!1;return this.Oa?this.Ba(t)&&(this.xa.next(t),e=!0):this.La(t,this.onlineState)&&(this.ka(t),e=!0),this.Na=t,e}onError(t){this.xa.error(t)}va(t){this.onlineState=t;let e=!1;return this.Na&&!this.Oa&&this.La(this.Na,t)&&(this.ka(this.Na),e=!0),e}La(t,e){if(!t.fromCache||!this.Da())return!0;const r=e!=="Offline";return(!this.options.Ka||!r)&&(!t.docs.isEmpty()||t.hasCachedResults||e==="Offline")}Ba(t){if(t.docChanges.length>0)return!0;const e=this.Na&&this.Na.hasPendingWrites!==t.hasPendingWrites;return!(!t.syncStateChanged&&!e)&&this.options.includeMetadataChanges===!0}ka(t){t=De.fromInitialDocuments(t.query,t.docs,t.mutatedKeys,t.fromCache,t.hasCachedResults),this.Oa=!0,this.xa.next(t)}Da(){return this.options.source!==gs.Cache}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class lu{constructor(t){this.key=t}}class hu{constructor(t){this.key=t}}class yd{constructor(t,e){this.query=t,this.Za=e,this.Xa=null,this.hasCachedResults=!1,this.current=!1,this.Ya=$(),this.mutatedKeys=$(),this.eu=La(t),this.tu=new Ie(this.eu)}get nu(){return this.Za}ru(t,e){const r=e?e.iu:new Bo,i=e?e.tu:this.tu;let o=e?e.mutatedKeys:this.mutatedKeys,u=i,l=!1;const f=this.query.limitType==="F"&&i.size===this.query.limit?i.last():null,d=this.query.limitType==="L"&&i.size===this.query.limit?i.first():null;if(t.inorderTraversal((_,v)=>{const R=i.get(_),C=ur(this.query,v)?v:null,O=!!R&&this.mutatedKeys.has(R.key),L=!!C&&(C.hasLocalMutations||this.mutatedKeys.has(C.key)&&C.hasCommittedMutations);let N=!1;R&&C?R.data.isEqual(C.data)?O!==L&&(r.track({type:3,doc:C}),N=!0):this.su(R,C)||(r.track({type:2,doc:C}),N=!0,(f&&this.eu(C,f)>0||d&&this.eu(C,d)<0)&&(l=!0)):!R&&C?(r.track({type:0,doc:C}),N=!0):R&&!C&&(r.track({type:1,doc:R}),N=!0,(f||d)&&(l=!0)),N&&(C?(u=u.add(C),o=L?o.add(_):o.delete(_)):(u=u.delete(_),o=o.delete(_)))}),this.query.limit!==null)for(;u.size>this.query.limit;){const _=this.query.limitType==="F"?u.last():u.first();u=u.delete(_.key),o=o.delete(_.key),r.track({type:1,doc:_})}return{tu:u,iu:r,Ss:l,mutatedKeys:o}}su(t,e){return t.hasLocalMutations&&e.hasCommittedMutations&&!e.hasLocalMutations}applyChanges(t,e,r,i){const o=this.tu;this.tu=t.tu,this.mutatedKeys=t.mutatedKeys;const u=t.iu.ya();u.sort((_,v)=>function(C,O){const L=N=>{switch(N){case 0:return 1;case 2:case 3:return 2;case 1:return 0;default:return M(20277,{Vt:N})}};return L(C)-L(O)}(_.type,v.type)||this.eu(_.doc,v.doc)),this.ou(r),i=i??!1;const l=e&&!i?this._u():[],f=this.Ya.size===0&&this.current&&!i?1:0,d=f!==this.Xa;return this.Xa=f,u.length!==0||d?{snapshot:new De(this.query,t.tu,o,u,t.mutatedKeys,f===0,d,!1,!!r&&r.resumeToken.approximateByteSize()>0),au:l}:{au:l}}va(t){return this.current&&t==="Offline"?(this.current=!1,this.applyChanges({tu:this.tu,iu:new Bo,mutatedKeys:this.mutatedKeys,Ss:!1},!1)):{au:[]}}uu(t){return!this.Za.has(t)&&!!this.tu.has(t)&&!this.tu.get(t).hasLocalMutations}ou(t){t&&(t.addedDocuments.forEach(e=>this.Za=this.Za.add(e)),t.modifiedDocuments.forEach(e=>{}),t.removedDocuments.forEach(e=>this.Za=this.Za.delete(e)),this.current=t.current)}_u(){if(!this.current)return[];const t=this.Ya;this.Ya=$(),this.tu.forEach(r=>{this.uu(r.key)&&(this.Ya=this.Ya.add(r.key))});const e=[];return t.forEach(r=>{this.Ya.has(r)||e.push(new hu(r))}),this.Ya.forEach(r=>{t.has(r)||e.push(new lu(r))}),e}cu(t){this.Za=t.ks,this.Ya=$();const e=this.ru(t.documents);return this.applyChanges(e,!0)}lu(){return De.fromInitialDocuments(this.query,this.tu,this.mutatedKeys,this.Xa===0,this.hasCachedResults)}}const js="SyncEngine";class Ed{constructor(t,e,r){this.query=t,this.targetId=e,this.view=r}}class Td{constructor(t){this.key=t,this.hu=!1}}class vd{constructor(t,e,r,i,o,u){this.localStore=t,this.remoteStore=e,this.eventManager=r,this.sharedClientState=i,this.currentUser=o,this.maxConcurrentLimboResolutions=u,this.Pu={},this.Tu=new he(l=>Ma(l),ar),this.Iu=new Map,this.Eu=new Set,this.Ru=new Z(k.comparator),this.Au=new Map,this.Vu=new Ds,this.du={},this.mu=new Map,this.fu=Pe.ar(),this.onlineState="Unknown",this.gu=void 0}get isPrimaryClient(){return this.gu===!0}}async function Id(n,t,e=!0){const r=gu(n);let i;const o=r.Tu.get(t);return o?(r.sharedClientState.addLocalQueryTarget(o.targetId),i=o.view.lu()):i=await fu(r,t,e,!0),i}async function wd(n,t){const e=gu(n);await fu(e,t,!0,!1)}async function fu(n,t,e,r){const i=await Hf(n.localStore,Pt(t)),o=i.targetId,u=n.sharedClientState.addLocalQueryTarget(o,e);let l;return r&&(l=await Ad(n,t,o,u==="current",i.resumeToken)),n.isPrimaryClient&&e&&ou(n.remoteStore,i),l}async function Ad(n,t,e,r,i){n.pu=(v,R,C)=>async function(L,N,W,H){let J=N.view.ru(W);J.Ss&&(J=await ko(L.localStore,N.query,!1).then(({documents:E})=>N.view.ru(E,J)));const Et=H&&H.targetChanges.get(N.targetId),lt=H&&H.targetMismatches.get(N.targetId)!=null,ht=N.view.applyChanges(J,L.isPrimaryClient,Et,lt);return zo(L,N.targetId,ht.au),ht.snapshot}(n,v,R,C);const o=await ko(n.localStore,t,!0),u=new yd(t,o.ks),l=u.ru(o.documents),f=_n.createSynthesizedTargetChangeForCurrentChange(e,r&&n.onlineState!=="Offline",i),d=u.applyChanges(l,n.isPrimaryClient,f);zo(n,e,d.au);const _=new Ed(t,e,u);return n.Tu.set(t,_),n.Iu.has(e)?n.Iu.get(e).push(t):n.Iu.set(e,[t]),d.snapshot}async function Rd(n,t,e){const r=q(n),i=r.Tu.get(t),o=r.Iu.get(i.targetId);if(o.length>1)return r.Iu.set(i.targetId,o.filter(u=>!ar(u,t))),void r.Tu.delete(t);r.isPrimaryClient?(r.sharedClientState.removeLocalQueryTarget(i.targetId),r.sharedClientState.isActiveQueryTarget(i.targetId)||await ms(r.localStore,i.targetId,!1).then(()=>{r.sharedClientState.clearQueryState(i.targetId),e&&xs(r.remoteStore,i.targetId),_s(r,i.targetId)}).catch(nr)):(_s(r,i.targetId),await ms(r.localStore,i.targetId,!0))}async function Sd(n,t){const e=q(n),r=e.Tu.get(t),i=e.Iu.get(r.targetId);e.isPrimaryClient&&i.length===1&&(e.sharedClientState.removeLocalQueryTarget(r.targetId),xs(e.remoteStore,r.targetId))}async function du(n,t){const e=q(n);try{const r=await $f(e.localStore,t);t.targetChanges.forEach((i,o)=>{const u=e.Au.get(o);u&&(Q(i.addedDocuments.size+i.modifiedDocuments.size+i.removedDocuments.size<=1,22616),i.addedDocuments.size>0?u.hu=!0:i.modifiedDocuments.size>0?Q(u.hu,14607):i.removedDocuments.size>0&&(Q(u.hu,42227),u.hu=!1))}),await pu(e,r,t)}catch(r){await nr(r)}}function $o(n,t,e){const r=q(n);if(r.isPrimaryClient&&e===0||!r.isPrimaryClient&&e===1){const i=[];r.Tu.forEach((o,u)=>{const l=u.view.va(t);l.snapshot&&i.push(l.snapshot)}),function(u,l){const f=q(u);f.onlineState=l;let d=!1;f.queries.forEach((_,v)=>{for(const R of v.ba)R.va(l)&&(d=!0)}),d&&Bs(f)}(r.eventManager,t),i.length&&r.Pu.J_(i),r.onlineState=t,r.isPrimaryClient&&r.sharedClientState.setOnlineState(t)}}async function Cd(n,t,e){const r=q(n);r.sharedClientState.updateQueryState(t,"rejected",e);const i=r.Au.get(t),o=i&&i.key;if(o){let u=new Z(k.comparator);u=u.insert(o,pt.newNoDocument(o,x.min()));const l=$().add(o),f=new hr(x.min(),new Map,new Z(U),u,l);await du(r,f),r.Ru=r.Ru.remove(o),r.Au.delete(t),qs(r)}else await ms(r.localStore,t,!1).then(()=>_s(r,t,e)).catch(nr)}function _s(n,t,e=null){n.sharedClientState.removeLocalQueryTarget(t);for(const r of n.Iu.get(t))n.Tu.delete(r),e&&n.Pu.yu(r,e);n.Iu.delete(t),n.isPrimaryClient&&n.Vu.Gr(t).forEach(r=>{n.Vu.containsKey(r)||mu(n,r)})}function mu(n,t){n.Eu.delete(t.path.canonicalString());const e=n.Ru.get(t);e!==null&&(xs(n.remoteStore,e),n.Ru=n.Ru.remove(t),n.Au.delete(e),qs(n))}function zo(n,t,e){for(const r of e)r instanceof lu?(n.Vu.addReference(r.key,t),bd(n,r)):r instanceof hu?(V(js,"Document no longer in limbo: "+r.key),n.Vu.removeReference(r.key,t),n.Vu.containsKey(r.key)||mu(n,r.key)):M(19791,{wu:r})}function bd(n,t){const e=t.key,r=e.path.canonicalString();n.Ru.get(e)||n.Eu.has(r)||(V(js,"New document in limbo: "+e),n.Eu.add(r),qs(n))}function qs(n){for(;n.Eu.size>0&&n.Ru.size<n.maxConcurrentLimboResolutions;){const t=n.Eu.values().next().value;n.Eu.delete(t);const e=new k(K.fromString(t)),r=n.fu.next();n.Au.set(r,new Td(e)),n.Ru=n.Ru.insert(e,r),ou(n.remoteStore,new jt(Pt(xa(e.path)),r,"TargetPurposeLimboResolution",rr.ce))}}async function pu(n,t,e){const r=q(n),i=[],o=[],u=[];r.Tu.isEmpty()||(r.Tu.forEach((l,f)=>{u.push(r.pu(f,t,e).then(d=>{var _;if((d||e)&&r.isPrimaryClient){const v=d?!d.fromCache:(_=e==null?void 0:e.targetChanges.get(f.targetId))==null?void 0:_.current;r.sharedClientState.updateQueryState(f.targetId,v?"current":"not-current")}if(d){i.push(d);const v=ks.Es(f.targetId,d);o.push(v)}}))}),await Promise.all(u),r.Pu.J_(i),await async function(f,d){const _=q(f);try{await _.persistence.runTransaction("notifyLocalViewChanges","readwrite",v=>S.forEach(d,R=>S.forEach(R.Ts,C=>_.persistence.referenceDelegate.addReference(v,R.targetId,C)).next(()=>S.forEach(R.Is,C=>_.persistence.referenceDelegate.removeReference(v,R.targetId,C)))))}catch(v){if(!Oe(v))throw v;V(Os,"Failed to update sequence numbers: "+v)}for(const v of d){const R=v.targetId;if(!v.fromCache){const C=_.vs.get(R),O=C.snapshotVersion,L=C.withLastLimboFreeSnapshotVersion(O);_.vs=_.vs.insert(R,L)}}}(r.localStore,o))}async function Pd(n,t){const e=q(n);if(!e.currentUser.isEqual(t)){V(js,"User change. New user:",t.toKey());const r=await nu(e.localStore,t);e.currentUser=t,function(o,u){o.mu.forEach(l=>{l.forEach(f=>{f.reject(new D(P.CANCELLED,u))})}),o.mu.clear()}(e,"'waitForPendingWrites' promise is rejected due to a user change."),e.sharedClientState.handleUserChange(t,r.removedBatchIds,r.addedBatchIds),await pu(e,r.Ns)}}function Vd(n,t){const e=q(n),r=e.Au.get(t);if(r&&r.hu)return $().add(r.key);{let i=$();const o=e.Iu.get(t);if(!o)return i;for(const u of o){const l=e.Tu.get(u);i=i.unionWith(l.view.nu)}return i}}function gu(n){const t=q(n);return t.remoteStore.remoteSyncer.applyRemoteEvent=du.bind(null,t),t.remoteStore.remoteSyncer.getRemoteKeysForTarget=Vd.bind(null,t),t.remoteStore.remoteSyncer.rejectListen=Cd.bind(null,t),t.Pu.J_=pd.bind(null,t.eventManager),t.Pu.yu=gd.bind(null,t.eventManager),t}class er{constructor(){this.kind="memory",this.synchronizeTabs=!1}async initialize(t){this.serializer=su(t.databaseInfo.databaseId),this.sharedClientState=this.Du(t),this.persistence=this.Cu(t),await this.persistence.start(),this.localStore=this.vu(t),this.gcScheduler=this.Fu(t,this.localStore),this.indexBackfillerScheduler=this.Mu(t,this.localStore)}Fu(t,e){return null}Mu(t,e){return null}vu(t){return qf(this.persistence,new Uf,t.initialUser,this.serializer)}Cu(t){return new eu(Ns.Vi,this.serializer)}Du(t){return new Kf}async terminate(){var t,e;(t=this.gcScheduler)==null||t.stop(),(e=this.indexBackfillerScheduler)==null||e.stop(),this.sharedClientState.shutdown(),await this.persistence.shutdown()}}er.provider={build:()=>new er};class Dd extends er{constructor(t){super(),this.cacheSizeBytes=t}Fu(t,e){Q(this.persistence.referenceDelegate instanceof tr,46915);const r=this.persistence.referenceDelegate.garbageCollector;return new Af(r,t.asyncQueue,e)}Cu(t){const e=this.cacheSizeBytes!==void 0?vt.withCacheSize(this.cacheSizeBytes):vt.DEFAULT;return new eu(r=>tr.Vi(r,e),this.serializer)}}class ys{async initialize(t,e){this.localStore||(this.localStore=t.localStore,this.sharedClientState=t.sharedClientState,this.datastore=this.createDatastore(e),this.remoteStore=this.createRemoteStore(e),this.eventManager=this.createEventManager(e),this.syncEngine=this.createSyncEngine(e,!t.synchronizeTabs),this.sharedClientState.onlineStateHandler=r=>$o(this.syncEngine,r,1),this.remoteStore.remoteSyncer.handleCredentialChange=Pd.bind(null,this.syncEngine),await ld(this.remoteStore,this.syncEngine.isPrimaryClient))}createEventManager(t){return function(){return new fd}()}createDatastore(t){const e=su(t.databaseInfo.databaseId),r=Xf(t.databaseInfo);return rd(t.authCredentials,t.appCheckCredentials,r,e)}createRemoteStore(t){return function(r,i,o,u,l){return new id(r,i,o,u,l)}(this.localStore,this.datastore,t.asyncQueue,e=>$o(this.syncEngine,e,0),function(){return Mo.v()?new Mo:new Qf}())}createSyncEngine(t,e){return function(i,o,u,l,f,d,_){const v=new vd(i,o,u,l,f,d);return _&&(v.gu=!0),v}(this.localStore,this.remoteStore,this.eventManager,this.sharedClientState,t.initialUser,t.maxConcurrentLimboResolutions,e)}async terminate(){var t,e;await async function(i){const o=q(i);V(Ve,"RemoteStore shutting down."),o.Ea.add(5),await yn(o),o.Aa.shutdown(),o.Va.set("Unknown")}(this.remoteStore),(t=this.datastore)==null||t.terminate(),(e=this.eventManager)==null||e.terminate()}}ys.provider={build:()=>new ys};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *//**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Nd{constructor(t){this.observer=t,this.muted=!1}next(t){this.muted||this.observer.next&&this.Ou(this.observer.next,t)}error(t){this.muted||(this.observer.error?this.Ou(this.observer.error,t):kt("Uncaught Error in snapshot listener:",t.toString()))}Nu(){this.muted=!0}Ou(t,e){setTimeout(()=>{this.muted||t(e)},0)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Xt="FirestoreClient";class kd{constructor(t,e,r,i,o){this.authCredentials=t,this.appCheckCredentials=e,this.asyncQueue=r,this._databaseInfo=i,this.user=mt.UNAUTHENTICATED,this.clientId=Ia.newId(),this.authCredentialListener=()=>Promise.resolve(),this.appCheckCredentialListener=()=>Promise.resolve(),this._uninitializedComponentsProvider=o,this.authCredentials.start(r,async u=>{V(Xt,"Received user=",u.uid),await this.authCredentialListener(u),this.user=u}),this.appCheckCredentials.start(r,u=>(V(Xt,"Received new app check token=",u),this.appCheckCredentialListener(u,this.user)))}get configuration(){return{asyncQueue:this.asyncQueue,databaseInfo:this._databaseInfo,clientId:this.clientId,authCredentials:this.authCredentials,appCheckCredentials:this.appCheckCredentials,initialUser:this.user,maxConcurrentLimboResolutions:100}}setCredentialChangeListener(t){this.authCredentialListener=t}setAppCheckTokenChangeListener(t){this.appCheckCredentialListener=t}terminate(){this.asyncQueue.enterRestrictedMode();const t=new ae;return this.asyncQueue.enqueueAndForgetEvenWhileRestricted(async()=>{try{this._onlineComponents&&await this._onlineComponents.terminate(),this._offlineComponents&&await this._offlineComponents.terminate(),this.authCredentials.shutdown(),this.appCheckCredentials.shutdown(),t.resolve()}catch(e){const r=cu(e,"Failed to shutdown persistence");t.reject(r)}}),t.promise}}async function Kr(n,t){n.asyncQueue.verifyOperationInProgress(),V(Xt,"Initializing OfflineComponentProvider");const e=n.configuration;await t.initialize(e);let r=e.initialUser;n.setCredentialChangeListener(async i=>{r.isEqual(i)||(await nu(t.localStore,i),r=i)}),t.persistence.setDatabaseDeletedListener(()=>n.terminate()),n._offlineComponents=t}async function Ho(n,t){n.asyncQueue.verifyOperationInProgress();const e=await Od(n);V(Xt,"Initializing OnlineComponentProvider"),await t.initialize(e,n.configuration),n.setCredentialChangeListener(r=>Uo(t.remoteStore,r)),n.setAppCheckTokenChangeListener((r,i)=>Uo(t.remoteStore,i)),n._onlineComponents=t}async function Od(n){if(!n._offlineComponents)if(n._uninitializedComponentsProvider){V(Xt,"Using user provided OfflineComponentProvider");try{await Kr(n,n._uninitializedComponentsProvider._offline)}catch(t){const e=t;if(!function(i){return i.name==="FirebaseError"?i.code===P.FAILED_PRECONDITION||i.code===P.UNIMPLEMENTED:!(typeof DOMException<"u"&&i instanceof DOMException)||i.code===22||i.code===20||i.code===11}(e))throw e;le("Error using user provided cache. Falling back to memory cache: "+e),await Kr(n,new er)}}else V(Xt,"Using default OfflineComponentProvider"),await Kr(n,new Dd(void 0));return n._offlineComponents}async function xd(n){return n._onlineComponents||(n._uninitializedComponentsProvider?(V(Xt,"Using user provided OnlineComponentProvider"),await Ho(n,n._uninitializedComponentsProvider._online)):(V(Xt,"Using default OnlineComponentProvider"),await Ho(n,new ys))),n._onlineComponents}async function Md(n){const t=await xd(n),e=t.eventManager;return e.onListen=Id.bind(null,t.syncEngine),e.onUnlisten=Rd.bind(null,t.syncEngine),e.onFirstRemoteStoreListen=wd.bind(null,t.syncEngine),e.onLastRemoteStoreUnlisten=Sd.bind(null,t.syncEngine),e}function Ld(n,t,e={}){const r=new ae;return n.asyncQueue.enqueueAndForget(async()=>function(o,u,l,f,d){const _=new Nd({next:R=>{_.Nu(),u.enqueueAndForget(()=>md(o,v)),R.fromCache&&f.source==="server"?d.reject(new D(P.UNAVAILABLE,'Failed to get documents from server. (However, these documents may exist in the local cache. Run again without setting source to "server" to retrieve the cached documents.)')):d.resolve(R)},error:R=>d.reject(R)}),v=new _d(l,_,{includeMetadataChanges:!0,Ka:!0});return dd(o,v)}(await Md(n),n.asyncQueue,t,e,r)),r.promise}/**
 * @license
 * Copyright 2023 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function _u(n){const t={};return n.timeoutSeconds!==void 0&&(t.timeoutSeconds=n.timeoutSeconds),t}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Fd="ComponentProvider",Go=new Map;function Ud(n,t,e,r,i){return new dh(n,t,e,i.host,i.ssl,i.experimentalForceLongPolling,i.experimentalAutoDetectLongPolling,_u(i.experimentalLongPollingOptions),i.useFetchStreams,i.isUsingEmulator,r)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const yu="firestore.googleapis.com",Ko=!0;class Qo{constructor(t){if(t.host===void 0){if(t.ssl!==void 0)throw new D(P.INVALID_ARGUMENT,"Can't provide ssl option if host option is not set");this.host=yu,this.ssl=Ko}else this.host=t.host,this.ssl=t.ssl??Ko;if(this.isUsingEmulator=t.emulatorOptions!==void 0,this.credentials=t.credentials,this.ignoreUndefinedProperties=!!t.ignoreUndefinedProperties,this.localCache=t.localCache,t.cacheSizeBytes===void 0)this.cacheSizeBytes=tu;else{if(t.cacheSizeBytes!==-1&&t.cacheSizeBytes<If)throw new D(P.INVALID_ARGUMENT,"cacheSizeBytes must be at least 1048576");this.cacheSizeBytes=t.cacheSizeBytes}Zl("experimentalForceLongPolling",t.experimentalForceLongPolling,"experimentalAutoDetectLongPolling",t.experimentalAutoDetectLongPolling),this.experimentalForceLongPolling=!!t.experimentalForceLongPolling,this.experimentalForceLongPolling?this.experimentalAutoDetectLongPolling=!1:t.experimentalAutoDetectLongPolling===void 0?this.experimentalAutoDetectLongPolling=!0:this.experimentalAutoDetectLongPolling=!!t.experimentalAutoDetectLongPolling,this.experimentalLongPollingOptions=_u(t.experimentalLongPollingOptions??{}),function(r){if(r.timeoutSeconds!==void 0){if(isNaN(r.timeoutSeconds))throw new D(P.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (must not be NaN)`);if(r.timeoutSeconds<5)throw new D(P.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (minimum allowed value is 5)`);if(r.timeoutSeconds>30)throw new D(P.INVALID_ARGUMENT,`invalid long polling timeout: ${r.timeoutSeconds} (maximum allowed value is 30)`)}}(this.experimentalLongPollingOptions),this.useFetchStreams=!!t.useFetchStreams}isEqual(t){return this.host===t.host&&this.ssl===t.ssl&&this.credentials===t.credentials&&this.cacheSizeBytes===t.cacheSizeBytes&&this.experimentalForceLongPolling===t.experimentalForceLongPolling&&this.experimentalAutoDetectLongPolling===t.experimentalAutoDetectLongPolling&&function(r,i){return r.timeoutSeconds===i.timeoutSeconds}(this.experimentalLongPollingOptions,t.experimentalLongPollingOptions)&&this.ignoreUndefinedProperties===t.ignoreUndefinedProperties&&this.useFetchStreams===t.useFetchStreams}}class $s{constructor(t,e,r,i){this._authCredentials=t,this._appCheckCredentials=e,this._databaseId=r,this._app=i,this.type="firestore-lite",this._persistenceKey="(lite)",this._settings=new Qo({}),this._settingsFrozen=!1,this._emulatorOptions={},this._terminateTask="notTerminated"}get app(){if(!this._app)throw new D(P.FAILED_PRECONDITION,"Firestore was not initialized using the Firebase SDK. 'app' is not available");return this._app}get _initialized(){return this._settingsFrozen}get _terminated(){return this._terminateTask!=="notTerminated"}_setSettings(t){if(this._settingsFrozen)throw new D(P.FAILED_PRECONDITION,"Firestore has already been started and its settings can no longer be changed. You can only modify settings before calling any other methods on a Firestore object.");this._settings=new Qo(t),this._emulatorOptions=t.emulatorOptions||{},t.credentials!==void 0&&(this._authCredentials=function(r){if(!r)return new $l;switch(r.type){case"firstParty":return new Kl(r.sessionIndex||"0",r.iamToken||null,r.authTokenFactory||null);case"provider":return r.client;default:throw new D(P.INVALID_ARGUMENT,"makeAuthCredentialsProvider failed due to invalid credential type")}}(t.credentials))}_getSettings(){return this._settings}_getEmulatorOptions(){return this._emulatorOptions}_freezeSettings(){return this._settingsFrozen=!0,this._settings}_delete(){return this._terminateTask==="notTerminated"&&(this._terminateTask=this._terminate()),this._terminateTask}async _restart(){this._terminateTask==="notTerminated"?await this._terminate():this._terminateTask="notTerminated"}toJSON(){return{app:this._app,databaseId:this._databaseId,settings:this._settings}}_terminate(){return function(e){const r=Go.get(e);r&&(V(Fd,"Removing Datastore"),Go.delete(e),r.terminate())}(this),Promise.resolve()}}function Bd(n,t,e,r={}){var d;n=ns(n,$s);const i=vs(t),o=n._getSettings(),u={...o,emulatorOptions:n._getEmulatorOptions()},l=`${t}:${e}`;i&&(pc(`https://${l}`),Ec("Firestore",!0)),o.host!==yu&&o.host!==l&&le("Host has been set in both settings() and connectFirestoreEmulator(), emulator host will be used.");const f={...o,host:l,ssl:i,emulatorOptions:r};if(!Kn(f,u)&&(n._setSettings(f),r.mockUserToken)){let _,v;if(typeof r.mockUserToken=="string")_=r.mockUserToken,v=mt.MOCK_USER;else{_=gc(r.mockUserToken,(d=n._app)==null?void 0:d.options.projectId);const R=r.mockUserToken.sub||r.mockUserToken.user_id;if(!R)throw new D(P.INVALID_ARGUMENT,"mockUserToken must contain 'sub' or 'user_id' field!");v=new mt(R)}n._authCredentials=new zl(new va(_,v))}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class dr{constructor(t,e,r){this.converter=e,this._query=r,this.type="query",this.firestore=t}withConverter(t){return new dr(this.firestore,t,this._query)}}class wt{constructor(t,e,r){this.converter=e,this._key=r,this.type="document",this.firestore=t}get _path(){return this._key.path}get id(){return this._key.path.lastSegment()}get path(){return this._key.path.canonicalString()}get parent(){return new we(this.firestore,this.converter,this._key.path.popLast())}withConverter(t){return new wt(this.firestore,t,this._key)}toJSON(){return{type:wt._jsonSchemaVersion,referencePath:this._key.toString()}}static fromJSON(t,e,r){if(pn(e,wt._jsonSchema))return new wt(t,r||null,new k(K.fromString(e.referencePath)))}}wt._jsonSchemaVersion="firestore/documentReference/1.0",wt._jsonSchema={type:nt("string",wt._jsonSchemaVersion),referencePath:nt("string")};class we extends dr{constructor(t,e,r){super(t,e,xa(r)),this._path=r,this.type="collection"}get id(){return this._query.path.lastSegment()}get path(){return this._query.path.canonicalString()}get parent(){const t=this._path.popLast();return t.isEmpty()?null:new wt(this.firestore,null,new k(t))}withConverter(t){return new we(this.firestore,t,this._path)}}function mm(n,t,...e){if(n=ua(n),n instanceof $s){const r=K.fromString(t,...e);return oo(r),new we(n,null,r)}{if(!(n instanceof wt||n instanceof we))throw new D(P.INVALID_ARGUMENT,"Expected first argument to collection() to be a CollectionReference, a DocumentReference or FirebaseFirestore");const r=n._path.child(K.fromString(t,...e));return oo(r),new we(n.firestore,null,r)}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Wo="AsyncQueue";class Jo{constructor(t=Promise.resolve()){this.Yu=[],this.ec=!1,this.tc=[],this.nc=null,this.rc=!1,this.sc=!1,this.oc=[],this.M_=new iu(this,"async_queue_retry"),this._c=()=>{const r=Gr();r&&V(Wo,"Visibility state changed to "+r.visibilityState),this.M_.w_()},this.ac=t;const e=Gr();e&&typeof e.addEventListener=="function"&&e.addEventListener("visibilitychange",this._c)}get isShuttingDown(){return this.ec}enqueueAndForget(t){this.enqueue(t)}enqueueAndForgetEvenWhileRestricted(t){this.uc(),this.cc(t)}enterRestrictedMode(t){if(!this.ec){this.ec=!0,this.sc=t||!1;const e=Gr();e&&typeof e.removeEventListener=="function"&&e.removeEventListener("visibilitychange",this._c)}}enqueue(t){if(this.uc(),this.ec)return new Promise(()=>{});const e=new ae;return this.cc(()=>this.ec&&this.sc?Promise.resolve():(t().then(e.resolve,e.reject),e.promise)).then(()=>e.promise)}enqueueRetryable(t){this.enqueueAndForget(()=>(this.Yu.push(t),this.lc()))}async lc(){if(this.Yu.length!==0){try{await this.Yu[0](),this.Yu.shift(),this.M_.reset()}catch(t){if(!Oe(t))throw t;V(Wo,"Operation failed with retryable error: "+t)}this.Yu.length>0&&this.M_.p_(()=>this.lc())}}cc(t){const e=this.ac.then(()=>(this.rc=!0,t().catch(r=>{throw this.nc=r,this.rc=!1,kt("INTERNAL UNHANDLED ERROR: ",Yo(r)),r}).then(r=>(this.rc=!1,r))));return this.ac=e,e}enqueueAfterDelay(t,e,r){this.uc(),this.oc.indexOf(t)>-1&&(e=0);const i=Us.createAndSchedule(this,t,e,r,o=>this.hc(o));return this.tc.push(i),i}uc(){this.nc&&M(47125,{Pc:Yo(this.nc)})}verifyOperationInProgress(){}async Tc(){let t;do t=this.ac,await t;while(t!==this.ac)}Ic(t){for(const e of this.tc)if(e.timerId===t)return!0;return!1}Ec(t){return this.Tc().then(()=>{this.tc.sort((e,r)=>e.targetTimeMs-r.targetTimeMs);for(const e of this.tc)if(e.skipDelay(),t!=="all"&&e.timerId===t)break;return this.Tc()})}Rc(t){this.oc.push(t)}hc(t){const e=this.tc.indexOf(t);this.tc.splice(e,1)}}function Yo(n){let t=n.message||"";return n.stack&&(t=n.stack.includes(n.message)?n.stack:n.message+`
`+n.stack),t}class Eu extends $s{constructor(t,e,r,i){super(t,e,r,i),this.type="firestore",this._queue=new Jo,this._persistenceKey=(i==null?void 0:i.name)||"[DEFAULT]"}async _terminate(){if(this._firestoreClient){const t=this._firestoreClient.terminate();this._queue=new Jo(t),this._firestoreClient=void 0,await t}}}function pm(n,t){const e=typeof n=="object"?n:Pl(),r=typeof n=="string"?n:Wn,i=wl(e,"firestore").getImmediate({identifier:r});if(!i._initialized){const o=dc("firestore");o&&Bd(i,...o)}return i}function jd(n){if(n._terminated)throw new D(P.FAILED_PRECONDITION,"The client has already been terminated.");return n._firestoreClient||qd(n),n._firestoreClient}function qd(n){var r,i,o,u;const t=n._freezeSettings(),e=Ud(n._databaseId,((r=n._app)==null?void 0:r.options.appId)||"",n._persistenceKey,(i=n._app)==null?void 0:i.options.apiKey,t);n._componentsProvider||(o=t.localCache)!=null&&o._offlineComponentProvider&&((u=t.localCache)!=null&&u._onlineComponentProvider)&&(n._componentsProvider={_offline:t.localCache._offlineComponentProvider,_online:t.localCache._onlineComponentProvider}),n._firestoreClient=new kd(n._authCredentials,n._appCheckCredentials,n._queue,e,n._componentsProvider&&function(f){const d=f==null?void 0:f._online.build();return{_offline:f==null?void 0:f._offline.build(d),_online:d}}(n._componentsProvider))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class bt{constructor(t){this._byteString=t}static fromBase64String(t){try{return new bt(ct.fromBase64String(t))}catch(e){throw new D(P.INVALID_ARGUMENT,"Failed to construct data from Base64 string: "+e)}}static fromUint8Array(t){return new bt(ct.fromUint8Array(t))}toBase64(){return this._byteString.toBase64()}toUint8Array(){return this._byteString.toUint8Array()}toString(){return"Bytes(base64: "+this.toBase64()+")"}isEqual(t){return this._byteString.isEqual(t._byteString)}toJSON(){return{type:bt._jsonSchemaVersion,bytes:this.toBase64()}}static fromJSON(t){if(pn(t,bt._jsonSchema))return bt.fromBase64String(t.bytes)}}bt._jsonSchemaVersion="firestore/bytes/1.0",bt._jsonSchema={type:nt("string",bt._jsonSchemaVersion),bytes:nt("string")};/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Tu{constructor(...t){for(let e=0;e<t.length;++e)if(t[e].length===0)throw new D(P.INVALID_ARGUMENT,"Invalid field name at argument $(i + 1). Field names must not be empty.");this._internalPath=new yt(t)}isEqual(t){return this._internalPath.isEqual(t._internalPath)}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Ht{constructor(t,e){if(!isFinite(t)||t<-90||t>90)throw new D(P.INVALID_ARGUMENT,"Latitude must be a number between -90 and 90, but was: "+t);if(!isFinite(e)||e<-180||e>180)throw new D(P.INVALID_ARGUMENT,"Longitude must be a number between -180 and 180, but was: "+e);this._lat=t,this._long=e}get latitude(){return this._lat}get longitude(){return this._long}isEqual(t){return this._lat===t._lat&&this._long===t._long}_compareTo(t){return U(this._lat,t._lat)||U(this._long,t._long)}toJSON(){return{latitude:this._lat,longitude:this._long,type:Ht._jsonSchemaVersion}}static fromJSON(t){if(pn(t,Ht._jsonSchema))return new Ht(t.latitude,t.longitude)}}Ht._jsonSchemaVersion="firestore/geoPoint/1.0",Ht._jsonSchema={type:nt("string",Ht._jsonSchemaVersion),latitude:nt("number"),longitude:nt("number")};/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gt{constructor(t){this._values=(t||[]).map(e=>e)}toArray(){return this._values.map(t=>t)}isEqual(t){return function(r,i){if(r.length!==i.length)return!1;for(let o=0;o<r.length;++o)if(r[o]!==i[o])return!1;return!0}(this._values,t._values)}toJSON(){return{type:Gt._jsonSchemaVersion,vectorValues:this._values}}static fromJSON(t){if(pn(t,Gt._jsonSchema)){if(Array.isArray(t.vectorValues)&&t.vectorValues.every(e=>typeof e=="number"))return new Gt(t.vectorValues);throw new D(P.INVALID_ARGUMENT,"Expected 'vectorValues' field to be a number array")}}}Gt._jsonSchemaVersion="firestore/vectorValue/1.0",Gt._jsonSchema={type:nt("string",Gt._jsonSchemaVersion),vectorValues:nt("object")};function vu(n,t,e){if((t=ua(t))instanceof Tu)return t._internalPath;if(typeof t=="string")return zd(n,t);throw Es("Field path arguments must be of type string or ",n)}const $d=new RegExp("[~\\*/\\[\\]]");function zd(n,t,e){if(t.search($d)>=0)throw Es(`Invalid field path (${t}). Paths must not contain '~', '*', '/', '[', or ']'`,n);try{return new Tu(...t.split("."))._internalPath}catch{throw Es(`Invalid field path (${t}). Paths must not be empty, begin with '.', end with '.', or contain '..'`,n)}}function Es(n,t,e,r,i){let o=`Function ${t}() called with invalid data`;o+=". ";let u="";return new D(P.INVALID_ARGUMENT,o+n+u)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Hd{convertValue(t,e="none"){switch(Jt(t)){case 0:return null;case 1:return t.booleanValue;case 2:return X(t.integerValue||t.doubleValue);case 3:return this.convertTimestamp(t.timestampValue);case 4:return this.convertServerTimestamp(t,e);case 5:return t.stringValue;case 6:return this.convertBytes(Wt(t.bytesValue));case 7:return this.convertReference(t.referenceValue);case 8:return this.convertGeoPoint(t.geoPointValue);case 9:return this.convertArray(t.arrayValue,e);case 11:return this.convertObject(t.mapValue,e);case 10:return this.convertVectorValue(t.mapValue);default:throw M(62114,{value:t})}}convertObject(t,e){return this.convertObjectMap(t.fields,e)}convertObjectMap(t,e="none"){const r={};return gn(t,(i,o)=>{r[i]=this.convertValue(o,e)}),r}convertVectorValue(t){var r,i,o;const e=(o=(i=(r=t.fields)==null?void 0:r[ss].arrayValue)==null?void 0:i.values)==null?void 0:o.map(u=>X(u.doubleValue));return new Gt(e)}convertGeoPoint(t){return new Ht(X(t.latitude),X(t.longitude))}convertArray(t,e){return(t.values||[]).map(r=>this.convertValue(r,e))}convertServerTimestamp(t,e){switch(e){case"previous":const r=ir(t);return r==null?null:this.convertValue(r,e);case"estimate":return this.convertTimestamp(fn(t));default:return null}}convertTimestamp(t){const e=Qt(t);return new et(e.seconds,e.nanos)}convertDocumentKey(t,e){const r=K.fromString(t);Q(Za(r),9688,{name:t});const i=new dn(r.get(1),r.get(3)),o=new k(r.popFirst(5));return i.isEqual(e)||kt(`Document ${o} contains a document reference within a different database (${i.projectId}/${i.database}) which is not supported. It will be treated as a reference in the current database (${e.projectId}/${e.database}) instead.`),o}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Gd extends Hd{constructor(t){super(),this.firestore=t}convertBytes(t){return new bt(t)}convertReference(t){const e=this.convertDocumentKey(t,this.firestore._databaseId);return new wt(this.firestore,null,e)}}const Xo="@firebase/firestore",Zo="4.12.0";/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Iu{constructor(t,e,r,i,o){this._firestore=t,this._userDataWriter=e,this._key=r,this._document=i,this._converter=o}get id(){return this._key.path.lastSegment()}get ref(){return new wt(this._firestore,this._converter,this._key)}exists(){return this._document!==null}data(){if(this._document){if(this._converter){const t=new Kd(this._firestore,this._userDataWriter,this._key,this._document,null);return this._converter.fromFirestore(t)}return this._userDataWriter.convertValue(this._document.data.value)}}_fieldsProto(){var t;return((t=this._document)==null?void 0:t.data.clone().value.mapValue.fields)??void 0}get(t){if(this._document){const e=this._document.data.field(vu("DocumentSnapshot.get",t));if(e!==null)return this._userDataWriter.convertValue(e)}}}class Kd extends Iu{data(){return super.data()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Qd(n){if(n.limitType==="L"&&n.explicitOrderBy.length===0)throw new D(P.UNIMPLEMENTED,"limitToLast() queries require specifying at least one orderBy() clause")}class Bn{constructor(t,e){this.hasPendingWrites=t,this.fromCache=e}isEqual(t){return this.hasPendingWrites===t.hasPendingWrites&&this.fromCache===t.fromCache}}class Ae extends Iu{constructor(t,e,r,i,o,u){super(t,e,r,i,u),this._firestore=t,this._firestoreImpl=t,this.metadata=o}exists(){return super.exists()}data(t={}){if(this._document){if(this._converter){const e=new Hn(this._firestore,this._userDataWriter,this._key,this._document,this.metadata,null);return this._converter.fromFirestore(e,t)}return this._userDataWriter.convertValue(this._document.data.value,t.serverTimestamps)}}get(t,e={}){if(this._document){const r=this._document.data.field(vu("DocumentSnapshot.get",t));if(r!==null)return this._userDataWriter.convertValue(r,e.serverTimestamps)}}toJSON(){if(this.metadata.hasPendingWrites)throw new D(P.FAILED_PRECONDITION,"DocumentSnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const t=this._document,e={};return e.type=Ae._jsonSchemaVersion,e.bundle="",e.bundleSource="DocumentSnapshot",e.bundleName=this._key.toString(),!t||!t.isValidDocument()||!t.isFoundDocument()?e:(this._userDataWriter.convertObjectMap(t.data.value.mapValue.fields,"previous"),e.bundle=(this._firestore,this.ref.path,"NOT SUPPORTED"),e)}}Ae._jsonSchemaVersion="firestore/documentSnapshot/1.0",Ae._jsonSchema={type:nt("string",Ae._jsonSchemaVersion),bundleSource:nt("string","DocumentSnapshot"),bundleName:nt("string"),bundle:nt("string")};class Hn extends Ae{data(t={}){return super.data(t)}}class Re{constructor(t,e,r,i){this._firestore=t,this._userDataWriter=e,this._snapshot=i,this.metadata=new Bn(i.hasPendingWrites,i.fromCache),this.query=r}get docs(){const t=[];return this.forEach(e=>t.push(e)),t}get size(){return this._snapshot.docs.size}get empty(){return this.size===0}forEach(t,e){this._snapshot.docs.forEach(r=>{t.call(e,new Hn(this._firestore,this._userDataWriter,r.key,r,new Bn(this._snapshot.mutatedKeys.has(r.key),this._snapshot.fromCache),this.query.converter))})}docChanges(t={}){const e=!!t.includeMetadataChanges;if(e&&this._snapshot.excludesMetadataChanges)throw new D(P.INVALID_ARGUMENT,"To include metadata changes with your document changes, you must also pass { includeMetadataChanges:true } to onSnapshot().");return this._cachedChanges&&this._cachedChangesIncludeMetadataChanges===e||(this._cachedChanges=function(i,o){if(i._snapshot.oldDocs.isEmpty()){let u=0;return i._snapshot.docChanges.map(l=>{const f=new Hn(i._firestore,i._userDataWriter,l.doc.key,l.doc,new Bn(i._snapshot.mutatedKeys.has(l.doc.key),i._snapshot.fromCache),i.query.converter);return l.doc,{type:"added",doc:f,oldIndex:-1,newIndex:u++}})}{let u=i._snapshot.oldDocs;return i._snapshot.docChanges.filter(l=>o||l.type!==3).map(l=>{const f=new Hn(i._firestore,i._userDataWriter,l.doc.key,l.doc,new Bn(i._snapshot.mutatedKeys.has(l.doc.key),i._snapshot.fromCache),i.query.converter);let d=-1,_=-1;return l.type!==0&&(d=u.indexOf(l.doc.key),u=u.delete(l.doc.key)),l.type!==1&&(u=u.add(l.doc),_=u.indexOf(l.doc.key)),{type:Wd(l.type),doc:f,oldIndex:d,newIndex:_}})}}(this,e),this._cachedChangesIncludeMetadataChanges=e),this._cachedChanges}toJSON(){if(this.metadata.hasPendingWrites)throw new D(P.FAILED_PRECONDITION,"QuerySnapshot.toJSON() attempted to serialize a document with pending writes. Await waitForPendingWrites() before invoking toJSON().");const t={};t.type=Re._jsonSchemaVersion,t.bundleSource="QuerySnapshot",t.bundleName=Ia.newId(),this._firestore._databaseId.database,this._firestore._databaseId.projectId;const e=[],r=[],i=[];return this.docs.forEach(o=>{o._document!==null&&(e.push(o._document),r.push(this._userDataWriter.convertObjectMap(o._document.data.value.mapValue.fields,"previous")),i.push(o.ref.path))}),t.bundle=(this._firestore,this.query._query,t.bundleName,"NOT SUPPORTED"),t}}function Wd(n){switch(n){case 0:return"added";case 2:case 3:return"modified";case 1:return"removed";default:return M(61501,{type:n})}}/**
 * @license
 * Copyright 2022 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Re._jsonSchemaVersion="firestore/querySnapshot/1.0",Re._jsonSchema={type:nt("string",Re._jsonSchemaVersion),bundleSource:nt("string","QuerySnapshot"),bundleName:nt("string"),bundle:nt("string")};function gm(n){n=ns(n,dr);const t=ns(n.firestore,Eu),e=jd(t),r=new Gd(t);return Qd(n._query),Ld(e,n._query).then(i=>new Re(t,r,n,i))}(function(t,e=!0){ql(Cl),Qn(new un("firestore",(r,{instanceIdentifier:i,options:o})=>{const u=r.getProvider("app").getImmediate(),l=new Eu(new Hl(r.getProvider("auth-internal")),new Ql(u,r.getProvider("app-check-internal")),mh(u,i),u);return o={useFetchStreams:e,...o},l._setSettings(o),l},"PUBLIC").setMultipleInstances(!0)),Ee(Xo,Zo,t),Ee(Xo,Zo,"esm2020")})();export{Pl as A,Kn as B,un as C,mc as D,gc as E,vs as F,pc as G,Ec as H,Cl as I,Ne as J,fm as K,ca as L,bl as M,pm as N,gm as O,mm as P,um as S,Qn as _,nc as a,sm as b,rm as c,lm as d,na as e,rc as f,cm as g,Al as h,j as i,Ki as j,nm as k,em as l,om as m,im as n,Yd as o,Xd as p,am as q,Ee as r,tm as s,ua as t,Jd as u,hm as v,oc as w,Zd as x,wl as y,dc as z};
