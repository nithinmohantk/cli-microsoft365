import * as assert from 'assert';
import * as chalk from 'chalk';
import * as sinon from 'sinon';
import appInsights from '../../../../appInsights';
import auth from '../../../../Auth';
import { Cli, Logger } from '../../../../cli';
import Command, { CommandError } from '../../../../Command';
import request from '../../../../request';
import Utils from '../../../../Utils';
import commands from '../../commands';
const command: Command = require('./hubsite-disconnect');

describe(commands.HUBSITE_DISCONNECT, () => {
  let log: string[];
  let logger: Logger;
  let loggerSpy: sinon.SinonSpy;
  let promptOptions: any;

  before(() => {
    sinon.stub(auth, 'restoreAuth').callsFake(() => Promise.resolve());
    sinon.stub(appInsights, 'trackEvent').callsFake(() => {});
    sinon.stub(command as any, 'getRequestDigest').callsFake(() => Promise.resolve({ FormDigestValue: 'ABC' }));
    auth.service.connected = true;
  });

  beforeEach(() => {
    log = [];
    logger = {
      log: (msg: string) => {
        log.push(msg);
      }
    };
    loggerSpy = sinon.spy(logger, 'log');
    sinon.stub(Cli, 'prompt').callsFake((options: any, cb: (result: { continue: boolean }) => void) => {
      promptOptions = options;
      cb({ continue: false });
    });
    promptOptions = undefined;
  });

  afterEach(() => {
    Utils.restore([
      request.post,
      Cli.prompt
    ]);
  });

  after(() => {
    Utils.restore([
      auth.restoreAuth,
      (command as any).getRequestDigest,
      appInsights.trackEvent
    ]);
    auth.service.connected = false;
  });

  it('has correct name', () => {
    assert.strictEqual(command.name.startsWith(commands.HUBSITE_DISCONNECT), true);
  });

  it('has a description', () => {
    assert.notStrictEqual(command.description, null);
  });

  it('disconnects the site from its hub site without prompting for confirmation when confirm option specified', (done) => {
    sinon.stub(request, 'post').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/_api/site/JoinHubSite('00000000-0000-0000-0000-000000000000')`) > -1) {
        return Promise.resolve({
          "odata.null": true
        });
      }

      return Promise.reject('Invalid request');
    });

    command.action(logger, { options: { debug: false, url: 'https://contoso.sharepoint.com/sites/Sales', confirm: true } }, () => {
      try {
        assert(loggerSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('disconnects the site from its hub site without prompting for confirmation when confirm option specified (debug)', (done) => {
    sinon.stub(request, 'post').callsFake((opts) => {
      if ((opts.url as string).indexOf(`/_api/site/JoinHubSite('00000000-0000-0000-0000-000000000000')`) > -1) {
        return Promise.resolve({
          "odata.null": true
        });
      }

      return Promise.reject('Invalid request');
    });

    command.action(logger, { options: { debug: true, url: 'https://contoso.sharepoint.com/sites/Sales', confirm: true } }, () => {
      try {
        assert(loggerSpy.calledWith(chalk.green('DONE')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('prompts before disconnecting the specified site from its hub site when confirm option not passed', (done) => {
    command.action(logger, { options: { debug: false, url: 'https://contoso.sharepoint.com/sites/Sales' } }, () => {
      let promptIssued = false;

      if (promptOptions && promptOptions.type === 'confirm') {
        promptIssued = true;
      }

      try {
        assert(promptIssued);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('aborts disconnecting site from its hub site when prompt not confirmed', (done) => {
    const postSpy = sinon.spy(request, 'post');
    Utils.restore(Cli.prompt);
    sinon.stub(Cli, 'prompt').callsFake((options: any, cb: (result: { continue: boolean }) => void) => {
      cb({ continue: false });
    });
    command.action(logger, { options: { debug: false, url: 'https://contoso.sharepoint.com/sites/Sales' } }, () => {
      try {
        assert(postSpy.notCalled);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('disconnects the site from its hub site when prompt confirmed', (done) => {
    const postStub = sinon.stub(request, 'post').callsFake(() => Promise.resolve({
      "odata.null": true
    }));
    Utils.restore(Cli.prompt);
    sinon.stub(Cli, 'prompt').callsFake((options: any, cb: (result: { continue: boolean }) => void) => {
      cb({ continue: true });
    });
    command.action(logger, { options: { debug: false, url: 'https://contoso.sharepoint.com/sites/Sales' } }, () => {
      try {
        assert(postStub.called);
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('correctly handles error', (done) => {
    sinon.stub(request, 'post').callsFake((opts) => {
      return Promise.reject({
        error: {
          "odata.error": {
            "code": "-1, Microsoft.SharePoint.Client.ResourceNotFoundException",
            "message": {
              "lang": "en-US",
              "value": "Exception of type 'Microsoft.SharePoint.Client.ResourceNotFoundException' was thrown."
            }
          }
        }
      });
    });

    command.action(logger, { options: { debug: false, url: 'https://contoso.sharepoint.com/sites/sales', confirm: true } } as any, (err?: any) => {
      try {
        assert.strictEqual(JSON.stringify(err), JSON.stringify(new CommandError('Exception of type \'Microsoft.SharePoint.Client.ResourceNotFoundException\' was thrown.')));
        done();
      }
      catch (e) {
        done(e);
      }
    });
  });

  it('supports debug mode', () => {
    const options = command.options();
    let containsOption = false;
    options.forEach(o => {
      if (o.option === '--debug') {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('supports specifying site URL', () => {
    const options = command.options();
    let containsOption = false;
    options.forEach(o => {
      if (o.option.indexOf('--url') > -1) {
        containsOption = true;
      }
    });
    assert(containsOption);
  });

  it('fails validation if url is not a valid SharePoint URL', () => {
    const actual = command.validate({ options: { url: 'abc' } });
    assert.notStrictEqual(actual, true);
  });

  it('passes validation when url is a valid SharePoint URL', () => {
    const actual = command.validate({ options: { url: 'https://contoso.sharepoint.com/sites/Sales' } });
    assert.strictEqual(actual, true);
  });
});