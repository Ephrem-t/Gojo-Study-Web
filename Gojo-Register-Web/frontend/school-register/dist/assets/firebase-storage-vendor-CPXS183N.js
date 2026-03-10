import{_ as ge,C as me,r as z,I as Re,h as be,J as we,t as L,y as Te,z as ye,A as ke,F as Z,G as Ee,H as Ae,E as Ue}from"./firebase-vendor-UEgviiMr.js";/**
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
 */const J="firebasestorage.googleapis.com",Q="storageBucket",Oe=2*60*1e3,Ie=10*60*1e3;/**
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
 */class l extends we{constructor(t,n,s=0){super(B(t),`Firebase Storage: ${n} (${B(t)})`),this.status_=s,this.customData={serverResponse:null},this._baseMessage=this.message,Object.setPrototypeOf(this,l.prototype)}get status(){return this.status_}set status(t){this.status_=t}_codeEquals(t){return B(t)===this.code}get serverResponse(){return this.customData.serverResponse}set serverResponse(t){this.customData.serverResponse=t,this.customData.serverResponse?this.message=`${this._baseMessage}
${this.customData.serverResponse}`:this.message=this._baseMessage}}var c;(function(e){e.UNKNOWN="unknown",e.OBJECT_NOT_FOUND="object-not-found",e.BUCKET_NOT_FOUND="bucket-not-found",e.PROJECT_NOT_FOUND="project-not-found",e.QUOTA_EXCEEDED="quota-exceeded",e.UNAUTHENTICATED="unauthenticated",e.UNAUTHORIZED="unauthorized",e.UNAUTHORIZED_APP="unauthorized-app",e.RETRY_LIMIT_EXCEEDED="retry-limit-exceeded",e.INVALID_CHECKSUM="invalid-checksum",e.CANCELED="canceled",e.INVALID_EVENT_NAME="invalid-event-name",e.INVALID_URL="invalid-url",e.INVALID_DEFAULT_BUCKET="invalid-default-bucket",e.NO_DEFAULT_BUCKET="no-default-bucket",e.CANNOT_SLICE_BLOB="cannot-slice-blob",e.SERVER_FILE_WRONG_SIZE="server-file-wrong-size",e.NO_DOWNLOAD_URL="no-download-url",e.INVALID_ARGUMENT="invalid-argument",e.INVALID_ARGUMENT_COUNT="invalid-argument-count",e.APP_DELETED="app-deleted",e.INVALID_ROOT_OPERATION="invalid-root-operation",e.INVALID_FORMAT="invalid-format",e.INTERNAL_ERROR="internal-error",e.UNSUPPORTED_ENVIRONMENT="unsupported-environment"})(c||(c={}));function B(e){return"storage/"+e}function H(){const e="An unknown error occurred, please check the error payload for server response.";return new l(c.UNKNOWN,e)}function Ne(e){return new l(c.OBJECT_NOT_FOUND,"Object '"+e+"' does not exist.")}function Ce(e){return new l(c.QUOTA_EXCEEDED,"Quota for bucket '"+e+"' exceeded, please view quota on https://firebase.google.com/pricing/.")}function Pe(){const e="User is not authenticated, please authenticate using Firebase Authentication and try again.";return new l(c.UNAUTHENTICATED,e)}function De(){return new l(c.UNAUTHORIZED_APP,"This app does not have permission to access Firebase Storage on this project.")}function xe(e){return new l(c.UNAUTHORIZED,"User does not have permission to access '"+e+"'.")}function Le(){return new l(c.RETRY_LIMIT_EXCEEDED,"Max retry time for operation exceeded, please try again.")}function Se(){return new l(c.CANCELED,"User canceled the upload/download.")}function ve(e){return new l(c.INVALID_URL,"Invalid URL '"+e+"'.")}function Be(e){return new l(c.INVALID_DEFAULT_BUCKET,"Invalid default bucket '"+e+"'.")}function Fe(){return new l(c.NO_DEFAULT_BUCKET,"No default bucket found. Did you set the '"+Q+"' property when initializing the app?")}function Me(){return new l(c.CANNOT_SLICE_BLOB,"Cannot slice blob for upload. Please retry the upload.")}function He(){return new l(c.NO_DOWNLOAD_URL,"The given file does not have any download URLs.")}function $e(e){return new l(c.UNSUPPORTED_ENVIRONMENT,`${e} is missing. Make sure to install the required polyfills. See https://firebase.google.com/docs/web/environments-js-sdk#polyfills for more information.`)}function M(e){return new l(c.INVALID_ARGUMENT,e)}function ee(){return new l(c.APP_DELETED,"The Firebase app was deleted.")}function je(e){return new l(c.INVALID_ROOT_OPERATION,"The operation '"+e+"' cannot be performed on a root reference, create a non-root reference using child, such as .child('file.png').")}function C(e,t){return new l(c.INVALID_FORMAT,"String does not match format '"+e+"': "+t)}function N(e){throw new l(c.INTERNAL_ERROR,"Internal error: "+e)}/**
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
 */class g{constructor(t,n){this.bucket=t,this.path_=n}get path(){return this.path_}get isRoot(){return this.path.length===0}fullServerUrl(){const t=encodeURIComponent;return"/b/"+t(this.bucket)+"/o/"+t(this.path)}bucketOnlyServerUrl(){return"/b/"+encodeURIComponent(this.bucket)+"/o"}static makeFromBucketSpec(t,n){let s;try{s=g.makeFromUrl(t,n)}catch{return new g(t,"")}if(s.path==="")return s;throw Be(t)}static makeFromUrl(t,n){let s=null;const r="([A-Za-z0-9.\\-_]+)";function o(_){_.path.charAt(_.path.length-1)==="/"&&(_.path_=_.path_.slice(0,-1))}const i="(/(.*))?$",a=new RegExp("^gs://"+r+i,"i"),u={bucket:1,path:3};function h(_){_.path_=decodeURIComponent(_.path)}const d="v[A-Za-z0-9_]+",R=n.replace(/[.]/g,"\\."),m="(/([^?#]*).*)?$",b=new RegExp(`^https?://${R}/${d}/b/${r}/o${m}`,"i"),w={bucket:1,path:3},k=n===J?"(?:storage.googleapis.com|storage.cloud.google.com)":n,p="([^?#]*)",I=new RegExp(`^https?://${k}/${r}/${p}`,"i"),T=[{regex:a,indices:u,postModify:o},{regex:b,indices:w,postModify:h},{regex:I,indices:{bucket:1,path:2},postModify:h}];for(let _=0;_<T.length;_++){const P=T[_],S=P.regex.exec(t);if(S){const _e=S[P.indices.bucket];let v=S[P.indices.path];v||(v=""),s=new g(_e,v),P.postModify(s);break}}if(s==null)throw ve(t);return s}}class Ve{constructor(t){this.promise_=Promise.reject(t)}getPromise(){return this.promise_}cancel(t=!1){}}/**
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
 */function qe(e,t,n){let s=1,r=null,o=null,i=!1,a=0;function u(){return a===2}let h=!1;function d(...p){h||(h=!0,t.apply(null,p))}function R(p){r=setTimeout(()=>{r=null,e(b,u())},p)}function m(){o&&clearTimeout(o)}function b(p,...I){if(h){m();return}if(p){m(),d.call(null,p,...I);return}if(u()||i){m(),d.call(null,p,...I);return}s<64&&(s*=2);let T;a===1?(a=2,T=0):T=(s+Math.random())*1e3,R(T)}let w=!1;function k(p){w||(w=!0,m(),!h&&(r!==null?(p||(a=2),clearTimeout(r),R(0)):p||(a=1)))}return R(0),o=setTimeout(()=>{i=!0,k(!0)},n),k}function ze(e){e(!1)}/**
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
 */function We(e){return e!==void 0}function Xe(e){return typeof e=="object"&&!Array.isArray(e)}function $(e){return typeof e=="string"||e instanceof String}function W(e){return j()&&e instanceof Blob}function j(){return typeof Blob<"u"}function X(e,t,n,s){if(s<t)throw M(`Invalid value for '${e}'. Expected ${t} or greater.`);if(s>n)throw M(`Invalid value for '${e}'. Expected ${n} or less.`)}/**
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
 */function V(e,t,n){let s=t;return n==null&&(s=`https://${t}`),`${n}://${s}/v0${e}`}function te(e){const t=encodeURIComponent;let n="?";for(const s in e)if(e.hasOwnProperty(s)){const r=t(s)+"="+t(e[s]);n=n+r+"&"}return n=n.slice(0,-1),n}var U;(function(e){e[e.NO_ERROR=0]="NO_ERROR",e[e.NETWORK_ERROR=1]="NETWORK_ERROR",e[e.ABORT=2]="ABORT"})(U||(U={}));/**
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
 */function Ke(e,t){const n=e>=500&&e<600,r=[408,429].indexOf(e)!==-1,o=t.indexOf(e)!==-1;return n||r||o}/**
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
 */class Ge{constructor(t,n,s,r,o,i,a,u,h,d,R,m=!0,b=!1){this.url_=t,this.method_=n,this.headers_=s,this.body_=r,this.successCodes_=o,this.additionalRetryCodes_=i,this.callback_=a,this.errorCallback_=u,this.timeout_=h,this.progressCallback_=d,this.connectionFactory_=R,this.retry=m,this.isUsingEmulator=b,this.pendingConnection_=null,this.backoffId_=null,this.canceled_=!1,this.appDelete_=!1,this.promise_=new Promise((w,k)=>{this.resolve_=w,this.reject_=k,this.start_()})}start_(){const t=(s,r)=>{if(r){s(!1,new D(!1,null,!0));return}const o=this.connectionFactory_();this.pendingConnection_=o;const i=a=>{const u=a.loaded,h=a.lengthComputable?a.total:-1;this.progressCallback_!==null&&this.progressCallback_(u,h)};this.progressCallback_!==null&&o.addUploadProgressListener(i),o.send(this.url_,this.method_,this.isUsingEmulator,this.body_,this.headers_).then(()=>{this.progressCallback_!==null&&o.removeUploadProgressListener(i),this.pendingConnection_=null;const a=o.getErrorCode()===U.NO_ERROR,u=o.getStatus();if(!a||Ke(u,this.additionalRetryCodes_)&&this.retry){const d=o.getErrorCode()===U.ABORT;s(!1,new D(!1,null,d));return}const h=this.successCodes_.indexOf(u)!==-1;s(!0,new D(h,o))})},n=(s,r)=>{const o=this.resolve_,i=this.reject_,a=r.connection;if(r.wasSuccessCode)try{const u=this.callback_(a,a.getResponse());We(u)?o(u):o()}catch(u){i(u)}else if(a!==null){const u=H();u.serverResponse=a.getErrorText(),this.errorCallback_?i(this.errorCallback_(a,u)):i(u)}else if(r.canceled){const u=this.appDelete_?ee():Se();i(u)}else{const u=Le();i(u)}};this.canceled_?n(!1,new D(!1,null,!0)):this.backoffId_=qe(t,n,this.timeout_)}getPromise(){return this.promise_}cancel(t){this.canceled_=!0,this.appDelete_=t||!1,this.backoffId_!==null&&ze(this.backoffId_),this.pendingConnection_!==null&&this.pendingConnection_.abort()}}class D{constructor(t,n,s){this.wasSuccessCode=t,this.connection=n,this.canceled=!!s}}function Ye(e,t){t!==null&&t.length>0&&(e.Authorization="Firebase "+t)}function Ze(e,t){e["X-Firebase-Storage-Version"]="webjs/"+(t??"AppManager")}function Je(e,t){t&&(e["X-Firebase-GMPID"]=t)}function Qe(e,t){t!==null&&(e["X-Firebase-AppCheck"]=t)}function et(e,t,n,s,r,o,i=!0,a=!1){const u=te(e.urlParams),h=e.url+u,d=Object.assign({},e.headers);return Je(d,t),Ye(d,n),Ze(d,o),Qe(d,s),new Ge(h,e.method,d,e.body,e.successCodes,e.additionalRetryCodes,e.handler,e.errorHandler,e.timeout,e.progressCallback,r,i,a)}/**
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
 */function tt(){return typeof BlobBuilder<"u"?BlobBuilder:typeof WebKitBlobBuilder<"u"?WebKitBlobBuilder:void 0}function nt(...e){const t=tt();if(t!==void 0){const n=new t;for(let s=0;s<e.length;s++)n.append(e[s]);return n.getBlob()}else{if(j())return new Blob(e);throw new l(c.UNSUPPORTED_ENVIRONMENT,"This browser doesn't seem to support creating Blobs")}}function st(e,t,n){return e.webkitSlice?e.webkitSlice(t,n):e.mozSlice?e.mozSlice(t,n):e.slice?e.slice(t,n):null}/**
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
 */function rt(e){if(typeof atob>"u")throw $e("base-64");return atob(e)}/**
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
 */const y={RAW:"raw",BASE64:"base64",BASE64URL:"base64url",DATA_URL:"data_url"};class F{constructor(t,n){this.data=t,this.contentType=n||null}}function ot(e,t){switch(e){case y.RAW:return new F(ne(t));case y.BASE64:case y.BASE64URL:return new F(se(e,t));case y.DATA_URL:return new F(at(t),ut(t))}throw H()}function ne(e){const t=[];for(let n=0;n<e.length;n++){let s=e.charCodeAt(n);if(s<=127)t.push(s);else if(s<=2047)t.push(192|s>>6,128|s&63);else if((s&64512)===55296)if(!(n<e.length-1&&(e.charCodeAt(n+1)&64512)===56320))t.push(239,191,189);else{const o=s,i=e.charCodeAt(++n);s=65536|(o&1023)<<10|i&1023,t.push(240|s>>18,128|s>>12&63,128|s>>6&63,128|s&63)}else(s&64512)===56320?t.push(239,191,189):t.push(224|s>>12,128|s>>6&63,128|s&63)}return new Uint8Array(t)}function it(e){let t;try{t=decodeURIComponent(e)}catch{throw C(y.DATA_URL,"Malformed data URL.")}return ne(t)}function se(e,t){switch(e){case y.BASE64:{const r=t.indexOf("-")!==-1,o=t.indexOf("_")!==-1;if(r||o)throw C(e,"Invalid character '"+(r?"-":"_")+"' found: is it base64url encoded?");break}case y.BASE64URL:{const r=t.indexOf("+")!==-1,o=t.indexOf("/")!==-1;if(r||o)throw C(e,"Invalid character '"+(r?"+":"/")+"' found: is it base64 encoded?");t=t.replace(/-/g,"+").replace(/_/g,"/");break}}let n;try{n=rt(t)}catch(r){throw r.message.includes("polyfill")?r:C(e,"Invalid character found")}const s=new Uint8Array(n.length);for(let r=0;r<n.length;r++)s[r]=n.charCodeAt(r);return s}class re{constructor(t){this.base64=!1,this.contentType=null;const n=t.match(/^data:([^,]+)?,/);if(n===null)throw C(y.DATA_URL,"Must be formatted 'data:[<mediatype>][;base64],<data>");const s=n[1]||null;s!=null&&(this.base64=ct(s,";base64"),this.contentType=this.base64?s.substring(0,s.length-7):s),this.rest=t.substring(t.indexOf(",")+1)}}function at(e){const t=new re(e);return t.base64?se(y.BASE64,t.rest):it(t.rest)}function ut(e){return new re(e).contentType}function ct(e,t){return e.length>=t.length?e.substring(e.length-t.length)===t:!1}/**
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
 */class E{constructor(t,n){let s=0,r="";W(t)?(this.data_=t,s=t.size,r=t.type):t instanceof ArrayBuffer?(n?this.data_=new Uint8Array(t):(this.data_=new Uint8Array(t.byteLength),this.data_.set(new Uint8Array(t))),s=this.data_.length):t instanceof Uint8Array&&(n?this.data_=t:(this.data_=new Uint8Array(t.length),this.data_.set(t)),s=t.length),this.size_=s,this.type_=r}size(){return this.size_}type(){return this.type_}slice(t,n){if(W(this.data_)){const s=this.data_,r=st(s,t,n);return r===null?null:new E(r)}else{const s=new Uint8Array(this.data_.buffer,t,n-t);return new E(s,!0)}}static getBlob(...t){if(j()){const n=t.map(s=>s instanceof E?s.data_:s);return new E(nt.apply(null,n))}else{const n=t.map(i=>$(i)?ot(y.RAW,i).data:i.data_);let s=0;n.forEach(i=>{s+=i.byteLength});const r=new Uint8Array(s);let o=0;return n.forEach(i=>{for(let a=0;a<i.length;a++)r[o++]=i[a]}),new E(r,!0)}}uploadData(){return this.data_}}/**
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
 */function oe(e){let t;try{t=JSON.parse(e)}catch{return null}return Xe(t)?t:null}/**
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
 */function lt(e){if(e.length===0)return null;const t=e.lastIndexOf("/");return t===-1?"":e.slice(0,t)}function ht(e,t){const n=t.split("/").filter(s=>s.length>0).join("/");return e.length===0?n:e+"/"+n}function ie(e){const t=e.lastIndexOf("/",e.length-2);return t===-1?e:e.slice(t+1)}/**
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
 */function dt(e,t){return t}class f{constructor(t,n,s,r){this.server=t,this.local=n||t,this.writable=!!s,this.xform=r||dt}}let x=null;function ft(e){return!$(e)||e.length<2?e:ie(e)}function ae(){if(x)return x;const e=[];e.push(new f("bucket")),e.push(new f("generation")),e.push(new f("metageneration")),e.push(new f("name","fullPath",!0));function t(o,i){return ft(i)}const n=new f("name");n.xform=t,e.push(n);function s(o,i){return i!==void 0?Number(i):i}const r=new f("size");return r.xform=s,e.push(r),e.push(new f("timeCreated")),e.push(new f("updated")),e.push(new f("md5Hash",null,!0)),e.push(new f("cacheControl",null,!0)),e.push(new f("contentDisposition",null,!0)),e.push(new f("contentEncoding",null,!0)),e.push(new f("contentLanguage",null,!0)),e.push(new f("contentType",null,!0)),e.push(new f("metadata","customMetadata",!0)),x=e,x}function pt(e,t){function n(){const s=e.bucket,r=e.fullPath,o=new g(s,r);return t._makeStorageReference(o)}Object.defineProperty(e,"ref",{get:n})}function _t(e,t,n){const s={};s.type="file";const r=n.length;for(let o=0;o<r;o++){const i=n[o];s[i.local]=i.xform(s,t[i.server])}return pt(s,e),s}function ue(e,t,n){const s=oe(t);return s===null?null:_t(e,s,n)}function gt(e,t,n,s){const r=oe(t);if(r===null||!$(r.downloadTokens))return null;const o=r.downloadTokens;if(o.length===0)return null;const i=encodeURIComponent;return o.split(",").map(h=>{const d=e.bucket,R=e.fullPath,m="/b/"+i(d)+"/o/"+i(R),b=V(m,n,s),w=te({alt:"media",token:h});return b+w})[0]}function mt(e,t){const n={},s=t.length;for(let r=0;r<s;r++){const o=t[r];o.writable&&(n[o.server]=e[o.local])}return JSON.stringify(n)}class ce{constructor(t,n,s,r){this.url=t,this.method=n,this.handler=s,this.timeout=r,this.urlParams={},this.headers={},this.body=null,this.errorHandler=null,this.progressCallback=null,this.successCodes=[200],this.additionalRetryCodes=[]}}/**
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
 */function le(e){if(!e)throw H()}function Rt(e,t){function n(s,r){const o=ue(e,r,t);return le(o!==null),o}return n}function bt(e,t){function n(s,r){const o=ue(e,r,t);return le(o!==null),gt(o,r,e.host,e._protocol)}return n}function he(e){function t(n,s){let r;return n.getStatus()===401?n.getErrorText().includes("Firebase App Check token is invalid")?r=De():r=Pe():n.getStatus()===402?r=Ce(e.bucket):n.getStatus()===403?r=xe(e.path):r=s,r.status=n.getStatus(),r.serverResponse=s.serverResponse,r}return t}function wt(e){const t=he(e);function n(s,r){let o=t(s,r);return s.getStatus()===404&&(o=Ne(e.path)),o.serverResponse=r.serverResponse,o}return n}function Tt(e,t,n){const s=t.fullServerUrl(),r=V(s,e.host,e._protocol),o="GET",i=e.maxOperationRetryTime,a=new ce(r,o,bt(e,n),i);return a.errorHandler=wt(t),a}function yt(e,t){return e&&e.contentType||t&&t.type()||"application/octet-stream"}function kt(e,t,n){const s=Object.assign({},n);return s.fullPath=e.path,s.size=t.size(),s.contentType||(s.contentType=yt(null,t)),s}function Et(e,t,n,s,r){const o=t.bucketOnlyServerUrl(),i={"X-Goog-Upload-Protocol":"multipart"};function a(){let T="";for(let _=0;_<2;_++)T=T+Math.random().toString().slice(2);return T}const u=a();i["Content-Type"]="multipart/related; boundary="+u;const h=kt(t,s,r),d=mt(h,n),R="--"+u+`\r
Content-Type: application/json; charset=utf-8\r
\r
`+d+`\r
--`+u+`\r
Content-Type: `+h.contentType+`\r
\r
`,m=`\r
--`+u+"--",b=E.getBlob(R,s,m);if(b===null)throw Me();const w={name:h.fullPath},k=V(o,e.host,e._protocol),p="POST",I=e.maxUploadRetryTime,A=new ce(k,p,Rt(e,n),I);return A.urlParams=w,A.headers=i,A.body=b.uploadData(),A.errorHandler=he(t),A}class At{constructor(){this.sent_=!1,this.xhr_=new XMLHttpRequest,this.initXhr(),this.errorCode_=U.NO_ERROR,this.sendPromise_=new Promise(t=>{this.xhr_.addEventListener("abort",()=>{this.errorCode_=U.ABORT,t()}),this.xhr_.addEventListener("error",()=>{this.errorCode_=U.NETWORK_ERROR,t()}),this.xhr_.addEventListener("load",()=>{t()})})}send(t,n,s,r,o){if(this.sent_)throw N("cannot .send() more than once");if(Z(t)&&s&&(this.xhr_.withCredentials=!0),this.sent_=!0,this.xhr_.open(n,t,!0),o!==void 0)for(const i in o)o.hasOwnProperty(i)&&this.xhr_.setRequestHeader(i,o[i].toString());return r!==void 0?this.xhr_.send(r):this.xhr_.send(),this.sendPromise_}getErrorCode(){if(!this.sent_)throw N("cannot .getErrorCode() before sending");return this.errorCode_}getStatus(){if(!this.sent_)throw N("cannot .getStatus() before sending");try{return this.xhr_.status}catch{return-1}}getResponse(){if(!this.sent_)throw N("cannot .getResponse() before sending");return this.xhr_.response}getErrorText(){if(!this.sent_)throw N("cannot .getErrorText() before sending");return this.xhr_.statusText}abort(){this.xhr_.abort()}getResponseHeader(t){return this.xhr_.getResponseHeader(t)}addUploadProgressListener(t){this.xhr_.upload!=null&&this.xhr_.upload.addEventListener("progress",t)}removeUploadProgressListener(t){this.xhr_.upload!=null&&this.xhr_.upload.removeEventListener("progress",t)}}class Ut extends At{initXhr(){this.xhr_.responseType="text"}}function de(){return new Ut}/**
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
 */class O{constructor(t,n){this._service=t,n instanceof g?this._location=n:this._location=g.makeFromUrl(n,t.host)}toString(){return"gs://"+this._location.bucket+"/"+this._location.path}_newRef(t,n){return new O(t,n)}get root(){const t=new g(this._location.bucket,"");return this._newRef(this._service,t)}get bucket(){return this._location.bucket}get fullPath(){return this._location.path}get name(){return ie(this._location.path)}get storage(){return this._service}get parent(){const t=lt(this._location.path);if(t===null)return null;const n=new g(this._location.bucket,t);return new O(this._service,n)}_throwIfRoot(t){if(this._location.path==="")throw je(t)}}function Ot(e,t,n){e._throwIfRoot("uploadBytes");const s=Et(e.storage,e._location,ae(),new E(t,!0),n);return e.storage.makeRequestWithTokens(s,de).then(r=>({metadata:r,ref:e}))}function It(e){e._throwIfRoot("getDownloadURL");const t=Tt(e.storage,e._location,ae());return e.storage.makeRequestWithTokens(t,de).then(n=>{if(n===null)throw He();return n})}function Nt(e,t){const n=ht(e._location.path,t),s=new g(e._location.bucket,n);return new O(e.storage,s)}/**
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
 */function Ct(e){return/^[A-Za-z]+:\/\//.test(e)}function Pt(e,t){return new O(e,t)}function fe(e,t){if(e instanceof q){const n=e;if(n._bucket==null)throw Fe();const s=new O(n,n._bucket);return t!=null?fe(s,t):s}else return t!==void 0?Nt(e,t):e}function Dt(e,t){if(t&&Ct(t)){if(e instanceof q)return Pt(e,t);throw M("To use ref(service, url), the first argument must be a Storage instance.")}else return fe(e,t)}function K(e,t){const n=t==null?void 0:t[Q];return n==null?null:g.makeFromBucketSpec(n,e)}function xt(e,t,n,s={}){e.host=`${t}:${n}`;const r=Z(t);r&&(Ee(`https://${e.host}/b`),Ae("Storage",!0)),e._isUsingEmulator=!0,e._protocol=r?"https":"http";const{mockUserToken:o}=s;o&&(e._overrideAuthToken=typeof o=="string"?o:Ue(o,e.app.options.projectId))}class q{constructor(t,n,s,r,o,i=!1){this.app=t,this._authProvider=n,this._appCheckProvider=s,this._url=r,this._firebaseVersion=o,this._isUsingEmulator=i,this._bucket=null,this._host=J,this._protocol="https",this._appId=null,this._deleted=!1,this._maxOperationRetryTime=Oe,this._maxUploadRetryTime=Ie,this._requests=new Set,r!=null?this._bucket=g.makeFromBucketSpec(r,this._host):this._bucket=K(this._host,this.app.options)}get host(){return this._host}set host(t){this._host=t,this._url!=null?this._bucket=g.makeFromBucketSpec(this._url,t):this._bucket=K(t,this.app.options)}get maxUploadRetryTime(){return this._maxUploadRetryTime}set maxUploadRetryTime(t){X("time",0,Number.POSITIVE_INFINITY,t),this._maxUploadRetryTime=t}get maxOperationRetryTime(){return this._maxOperationRetryTime}set maxOperationRetryTime(t){X("time",0,Number.POSITIVE_INFINITY,t),this._maxOperationRetryTime=t}async _getAuthToken(){if(this._overrideAuthToken)return this._overrideAuthToken;const t=this._authProvider.getImmediate({optional:!0});if(t){const n=await t.getToken();if(n!==null)return n.accessToken}return null}async _getAppCheckToken(){if(be(this.app)&&this.app.settings.appCheckToken)return this.app.settings.appCheckToken;const t=this._appCheckProvider.getImmediate({optional:!0});return t?(await t.getToken()).token:null}_delete(){return this._deleted||(this._deleted=!0,this._requests.forEach(t=>t.cancel()),this._requests.clear()),Promise.resolve()}_makeStorageReference(t){return new O(this,t)}_makeRequest(t,n,s,r,o=!0){if(this._deleted)return new Ve(ee());{const i=et(t,this._appId,s,r,n,this._firebaseVersion,o,this._isUsingEmulator);return this._requests.add(i),i.getPromise().then(()=>this._requests.delete(i),()=>this._requests.delete(i)),i}}async makeRequestWithTokens(t,n){const[s,r]=await Promise.all([this._getAuthToken(),this._getAppCheckToken()]);return this._makeRequest(t,n,s,r).getPromise()}}const G="@firebase/storage",Y="0.14.1";/**
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
 */const pe="storage";function Ft(e,t,n){return e=L(e),Ot(e,t,n)}function Mt(e){return e=L(e),It(e)}function Ht(e,t){return e=L(e),Dt(e,t)}function $t(e=ke(),t){e=L(e);const s=Te(e,pe).getImmediate({identifier:t}),r=ye("storage");return r&&Lt(s,...r),s}function Lt(e,t,n,s={}){xt(e,t,n,s)}function St(e,{instanceIdentifier:t}){const n=e.getProvider("app").getImmediate(),s=e.getProvider("auth-internal"),r=e.getProvider("app-check-internal");return new q(n,s,r,t,Re)}function vt(){ge(new me(pe,St,"PUBLIC").setMultipleInstances(!0)),z(G,Y,""),z(G,Y,"esm2020")}vt();export{Mt as a,$t as g,Ht as r,Ft as u};
