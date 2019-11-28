/* eslint-disable @typescript-eslint/no-explicit-any */
import mitt from 'mitt';
import {
  MethodPattern,
  URLPathPattern,
  Request,
  Response,
  Context,
  Middleware,
  RouteOptions,
  RouteResult,
  BeforeEvent,
  AfterEvent,
  ErrorEvent,
  ExecutionContext,
  RequestWithParameters,
} from './types';
import {defaultErrorListener} from './utils/defaultErrorListener';
import {createMiddleware} from './utils/createMiddleware';
import {normaliseRequest, normaliseContext} from './utils/normalise';
import {routeSync} from './utils/routeSync';
import {routeAsync} from './utils/routeAsync';
import {isRedirect} from './utils/isRedirect';

export class Router {
  private emitter: mitt.Emitter = mitt();
  private middleware: Middleware[] = [];

  constructor() {
    // register a default event handler until the user registers their own to avoid throwing an error
    this.emitter.on('error', defaultErrorListener);
  }

  private emitBeforeEvent(request: Request, context: Context) {
    this.emitter.emit('before', {
      request,
      context,
    });
  }

  private emitAfterEvent(
    request: Request,
    response: Response,
    context: Context,
  ) {
    this.emitter.emit('after', {
      request,
      response,
      context,
    });
  }

  private emitErrorEvent(request: Request, error: any, context: Context) {
    this.emitter.emit('error', {
      request,
      error,
      context,
    });
  }

  public on(type: 'before', listener: (data: BeforeEvent) => void): Router;
  public on(type: 'after', listener: (data: AfterEvent) => void): Router;
  public on(type: 'error', listener: (data: ErrorEvent) => void): Router;
  public on(
    type: 'before' | 'after' | 'error',
    listener:
      | ((data: BeforeEvent) => void)
      | ((data: AfterEvent) => void)
      | ((data: ErrorEvent) => void),
  ): Router {
    this.emitter.on(type, listener);
    // remove the default error listener when the user adds their own
    if (type === 'error') {
      this.emitter.off('error', defaultErrorListener);
    }
    return this;
  }

  public off(type: 'before', listener: (data: BeforeEvent) => void): Router;
  public off(type: 'after', listener: (data: AfterEvent) => void): Router;
  public off(type: 'error', listener: (data: ErrorEvent) => void): Router;
  public off(
    type: 'before' | 'after' | 'error',
    listener:
      | ((data: BeforeEvent) => void)
      | ((data: AfterEvent) => void)
      | ((data: ErrorEvent) => void),
  ): Router {
    this.emitter.off(type, listener);
    return this;
  }

  public use(middleware: Middleware): Router;
  public use(
    method: MethodPattern,
    path: URLPathPattern,
    middlewareOrResponse: Middleware<RequestWithParameters> | Partial<Response>,
  ): Router;
  public use(
    methodOrMiddleware: MethodPattern | Middleware,
    path?: URLPathPattern,
    middlewareOrResponse?:
      | Middleware<RequestWithParameters>
      | Partial<Response>,
  ): Router {
    if (typeof methodOrMiddleware === 'function') {
      this.middleware.push(methodOrMiddleware);
    } else if (path && middlewareOrResponse) {
      this.middleware.push(
        createMiddleware(methodOrMiddleware, path, middlewareOrResponse),
      );
    } else {
      throw new TypeError('Invalid arguments.');
    }
    return this;
  }

  public all(
    path: URLPathPattern,
    middlewareOrResponse: Middleware<RequestWithParameters> | Partial<Response>,
  ): Router {
    this.use('*', path, middlewareOrResponse);
    return this;
  }

  public options(
    path: URLPathPattern,
    middlewareOrResponse: Middleware<RequestWithParameters> | Partial<Response>,
  ): Router {
    this.use('options', path, middlewareOrResponse);
    return this;
  }

  public head(
    path: URLPathPattern,
    middlewareOrResponse: Middleware<RequestWithParameters> | Partial<Response>,
  ): Router {
    this.use('head', path, middlewareOrResponse);
    return this;
  }

  public get(
    path: URLPathPattern,
    middlewareOrResponse: Middleware<RequestWithParameters> | Partial<Response>,
  ): Router {
    this.use('get', path, middlewareOrResponse);
    return this;
  }

  public post(
    path: URLPathPattern,
    middlewareOrResponse: Middleware<RequestWithParameters> | Partial<Response>,
  ): Router {
    this.use('post', path, middlewareOrResponse);
    return this;
  }

  public put(
    path: URLPathPattern,
    middlewareOrResponse: Middleware<RequestWithParameters> | Partial<Response>,
  ): Router {
    this.use('put', path, middlewareOrResponse);
    return this;
  }

  public patch(
    path: URLPathPattern,
    middlewareOrResponse: Middleware<RequestWithParameters> | Partial<Response>,
  ): Router {
    this.use('patch', path, middlewareOrResponse);
    return this;
  }

  public delete(
    path: URLPathPattern,
    middlewareOrResponse: Middleware<RequestWithParameters> | Partial<Response>,
  ): Router {
    this.use('delete', path, middlewareOrResponse);
    return this;
  }

  public routeSync(
    request: Partial<Request>,
    options: RouteOptions = {redirect: 'follow'},
  ): RouteResult {
    let normalisedRequest = normaliseRequest(request);
    let normalisedContext = normaliseContext({
      execution: ExecutionContext.Synchronous,
    });
    let normalisedResponse: Response;
    try {
      do {
        this.emitBeforeEvent(normalisedRequest, normalisedContext);
        normalisedResponse = routeSync(
          normalisedRequest,
          normalisedContext,
          this.middleware,
        );
        this.emitAfterEvent(
          normalisedRequest,
          normalisedResponse,
          normalisedContext,
        );
        // TODO: create redirect request
      } while (options.redirect && isRedirect(normalisedResponse));
      return {
        url: normalisedRequest.url,
        redirected: false,
        ...normalisedResponse,
      };
    } catch (error) {
      this.emitErrorEvent(normalisedRequest, error, normalisedContext);
      throw error;
    }
  }

  public async routeAsync(
    request: Partial<Request>,
    options: RouteOptions = {redirect: 'follow'},
  ): Promise<RouteResult> {
    let normalisedRequest = normaliseRequest(request);
    let normalisedContext = normaliseContext({
      execution: ExecutionContext.Asynchronous,
    });
    let normalisedResponse: Response;
    try {
      do {
        this.emitBeforeEvent(normalisedRequest, normalisedContext);
        normalisedResponse = await routeAsync(
          normalisedRequest,
          normalisedContext,
          this.middleware,
        );
        this.emitAfterEvent(
          normalisedRequest,
          normalisedResponse,
          normalisedContext,
        );
        // TODO: create redirect request
      } while (options.redirect && isRedirect(normalisedResponse));
      return {
        url: normalisedRequest.url,
        redirected: false,
        ...normalisedResponse,
      };
    } catch (error) {
      this.emitErrorEvent(normalisedRequest, error, normalisedContext);
      throw error;
    }
  }
}
