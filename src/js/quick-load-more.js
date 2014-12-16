/* example config object:
{
    // When the item count is less than this value, a background request will be issued to load more items
    lowItemThreshold: 20,
    serviceURL: "/api/v1/products.json",
    responseItemExtractor: function(response){
        return response.items;
    },
    state: {
        start: 0,
        count: 24,
        searchQuery: null,
        tags: []
    }
};
*/
// ## quick-load-more

// quick-load-more, or QLM, enables faster user response times in "load more"
// scenarios. It achieves this by preemptively issuing requests to load more
// items and returning them on user request. It maintains a local cache and 
// aims to keep it populated above a certain number of items.

// ### Usage

// Instantiate `QLM` using a `config` object containing these fields:
// * `serviceURL`: The only required parameter. Contains the URL to the JSON endpoint for the items.
// * `lowItemThreshold`: When the item count is less than this value, a background request will be issued to load more items. Default: 20
// * `parameterState`: A set of key/value pairs to pass to the service as query parameters. Defaults to `start: 0` and `count: 20`
// * `responseItemExtractor`: A function that transforms the AJAX response from `serviceURL` to an array of items. A default implementation is provided, and it just returns the `items` property in the response.
// * `fieldNames`: A set of key field names used to construct URLS.
//   * `start`: name for the start parameter, used to indicate the index of the first element to return from the service. Defaults to: `start`
//   * `count`: name for the count parameter, used to indicate the number of items to return from the service. Defaults to: `count`
// * `event`: a configuration object for the events emitted by this component
//   * `namespace`: the prefix for all the events emitted.
//   * `names`
//     * `loadStarted`: the name for the load started event. Useful for displaying a loading icon. Defaults to 'loadStarted'.
//     * `loadFinished`: the name for the load finished event. Useful for hiding a loading icon. Defaults to 'loadFinished'.
//     * `error`: the name for the error event. Triggered on a server error. Defaults to 'error'.
//     * `exhausted`: the name for the exhaustion event. Triggered when there are no more items even on the server. Defaults to 'exhausted'.

// After instantiantion, just call the `get()` method with the number of items needed.

// #### Example

// ```
// var qlm = new QLM({serviceURL: '/api/v1/products.json'});
// qlm.get(10).then(function(items){
//   // do something with the items here    
// });
// // This will trigger qlm.loadStarted and qlm.loadFinished events.


var QLM = (function($){
    return function(customConfig){
        "use strict";

        // The only critically required parameter is `serviceURL`, and 
        // we should make this as clear as possible.
        if(!customConfig.serviceURL){
            throw new Error('No service URL provided.');
        }

        // The default config object, to be extended with the config the user provides
        var config = {
            lowItemThreshold: 20,
            event:{
                namespace: 'qlm',
                names: {
                    loadStarted: 'loadStarted',
                    loadFinished: 'loadFinished',
                    error: 'error',
                    exhausted: 'exhausted'
                }
            },
            paginator: {
                state: {
                    start: 0,
                    count: 50
                },
                next: function(currentState){
                    // return new paginator.state
                    currentState.start += currentState.count;
                    return currentState;
                }
            },
            isServerExhausted: function(response){
                // return true/false
                return response.exhausted;
            },
            extractItems: function(response){
                // return items from response
                return response.items;
            }

        };


        // add or override using user values
        $.extend(true, config, customConfig);
        

        // The item storage
        var localCache = [],

            queryParameters = {},

            paginator = config.paginator,
            isServerExhausted = config.isServerExhausted,
            extractItems = config.extractItems,

            // The promise object related to the ongoing server request (if any)
            ongoingRequestPromise = null,

            // Issues a GET request to the server, to populate the local cache.
            populateLocalCache = function(){
                return $.ajax({
                    url: getURL(queryParameters, paginator.state),
                    type: "GET"
                }).then(function(response){
                    ongoingRequestPromise = null;
                    // extract items
                    var items = extractItems(response);
                    // append the items to the array
                    Array.prototype.push.apply(localCache, items);
                    // increase the start field
                    paginator.state = paginator.next(paginator.state);

                    if(isServerExhausted(response)){
                        triggerEvent('exhausted');
                    }

                    return items.length;
                }, function(error){
                    ongoingRequestPromise = null;
                    return error;
                });
            },

            // Constructs an URL from the current state. For each `state`, 
            // query parameters in the form of`key=value` will be generated from
            // `key: value` pairs in the `state` object.
            getURL = function(parameters, paginatorState){
                var queryParameters = [];
                $.each(arguments, function(index, argument){
                    $.each(argument, function(parameterName, value){
                        var queryParameter = '';
                        if($.isArray(value)){
                            queryParameter = $.map(value, function(v){ return parameterName + '=' + v; }).join('&');
                        }else{
                            queryParameter = parameterName + '=' + value;
                        }
                        queryParameters.push(queryParameter);
                    });
                });
                return config.serviceURL + '?' + queryParameters.join('&');
            },
            setParameter = function(parameter, value){
                config.parameterState[parameter] = value;
            },
            getParameter = function(parameter){
                return config.parameterState[parameter];
            },

            // Returns a list of items of specified size. The size of the returned
            // list may be less than `numberOfItems` if not enough items exist.
            get = function(numberOfItems){
                // if a request is already being made to the server, reuse the promise, and attach the callabck to its chain*/
                if (ongoingRequestPromise) {
                    return ongoingRequestPromise.then(function () {
                        return get(numberOfItems);
                    });
                }
    
                // if the number of items in the local cache is insufficent 
                if(localCache.length < numberOfItems){
                    triggerEvent('loadStarted');
                    ongoingRequestPromise = populateLocalCache().then(function(retrievedItemCount){
                        // TODO: control item count and get more if needed, stop on zero.
                        // get and remove items from the local cache, starting from the beginning 
                        var items = localCache.splice(0, numberOfItems);
                        triggerEvent('loadFinished');
                        return items;
                    }, function(error){
                        triggerEvent('loadFinished');
                        triggerEvent('error');
                    });
                    // we'll return the current promise to allow attaching of then() calls 
                    return ongoingRequestPromise;
                }

                // if we have enough items in the local cache 
                var result = new $.Deferred(),
                    // get and remove items from the local cache, starting from the beginning 
                    items = localCache.splice(0, numberOfItems);

                // attach the items to the deferred and resolve it 
                result.resolve(items);
                    
                // if we're running low on items, issue a background request
                if(localCache.length < config.lowItemThreshold){
                    ongoingRequestPromise = populateLocalCache();
                }

                return result;
            },
            // trigger an event with the given name
            triggerEvent = function(event){
                var eventName = config.event.namespace + '.' + config.event.names[event];
                $(document).trigger(eventName);
            };
        return {
            get: get,
            __getURL: getURL,
            __localCache: localCache
        };
    };
})(jQuery);