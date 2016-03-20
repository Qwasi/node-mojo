// Copyright (c) 2015-2016, Qwasi Inc (http://www.qwasi.com/)
// All rights reserved.
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//    * Redistributions of source code must retain the above copyright
//      notice, this list of conditions and the following disclaimer.
//    * Redistributions in binary form must reproduce the above copyright
//      notice, this list of conditions and the following disclaimer in the
//      documentation and/or other materials provided with the distribution.
//    * Neither the name of Qwasi nor the
//      names of its contributors may be used to endorse or promote products
//      derived from this software without specific prior written permission.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
// ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL QWASI BE LIABLE FOR ANY
// DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
// (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
// LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
// ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
// SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.SOFTWARE

'use strict';

import util from 'util';
import EventEmitter from 'events';
import request from 'request';
import promise from 'bluebird';
import jwt_decode from 'jwt-decode';
import _ from 'lodash';
import log from './log';

export default class Client extends EventEmitter {
    constructor(options) {
        super();
        
        options = options || {};
        
        this.url = options.url;
        this.client_id = options.client_id;
        this.client_secret = options.client_secret;
    }
    
    // login returns a user token, using the client_id and client_secret
    // if the api client does not have permission to authenticate users the
    // call will fail.
    login(creds, options, callback) {
        const login_url = util.format('%s/%s', this.url, 'session');
        
        if (_.isFunction(creds)) {
            callback = creds;
            creds = undefined;
        }
        if (_.isFunction(options)) {
            callback = options;
            options = undefined;
        }
        creds = creds || {};
        options = options || {};
        
        _.defaults(creds, {
            client_id: this.client_id,
            client_secret: this.client_secret
        });
        
        if (creds.username && creds.password) {
            options.grant_type = options.grant_type || 'password';
        }
        
        _.defaults(options, {
            grant_type: 'client_credentials'
        });
        
        return new promise((resolve, reject) => {
            request.post({
                url: login_url,
                auth: {
                    username: creds.client_id,
                    password: creds.client_secret
                },
                form: {
                    grant_type: options.grant_type,
                    username: creds.username || undefined,
                    password: creds.password || undefined
                },
                json: true
            }, (err, response, body) => {
                if (err) {
                    log('Client %s authenticatication failed: %s.', creds.username || creds.client_id, err);
                    return reject(err);
                }
                if (response.statusCode >= 400) {
                    let error = body.error_description || body.error;
                    log('Client %s authenticatication failed: %s.', creds.username || creds.client_id, error);
                    return reject(new Error(error));
                }
                
                log('Client %s authenticated successfully.', creds.username || creds.client_id);
                resolve(body);
            });
        }).nodeify(callback);
    }
    
    // logout deletes the token and invalidates the session associated with
    // that token.
    logout(token, callback) {
        var logout_url = util.format('%s/%s/%s', this.url, 'session', token);
        
        return new promise((resolve, reject) => {
            let owner = null;
            
            try {
                let session = jwt_decode(token);
                owner = session.owner.name;
            } catch (e) {
                log('Failed to decode session token: %s.', e);
                return reject(e);
            }
        
            request.del({
                url: logout_url,
                json: true
            }, (err, response, body) => {
                if (err) {
                    log('Client %s session delete failed: %s.', owner, err);
                    return reject(err);
                }
                if (response.statusCode >= 400) {
                    let error = body.error_description || body.error;
                    log('Client %s session delete failed: %s.', owner, error);
                    return reject(new Error(error));
                }
                log('Client %s session deleted.', owner);
                return resolve(body);
            });   
        }).nodeify(callback);
    }
}