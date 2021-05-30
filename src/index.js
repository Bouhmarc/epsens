const {
  CookieKonnector,
  requestFactory,
  scrape,
  log,
  utils,
  saveFiles
} = require('cozy-konnector-libs')

const baseUrl = "https://www.gestion-epargne-salariale.fr/"

class EpsensConnector extends CookieKonnector
{
  constructor(){
    super()
    this.request = requestFactory({
      // The debug mode shows all the details about HTTP requests and responses. Very useful for
      // debugging but very verbose. This is why it is commented out by default
      // debug: true,
      // Activates [cheerio](https://cheerio.js.org/) parsing on each page
      cheerio: true,
      // If cheerio is activated do not forget to deactivate json parsing (which is activated by
      // default in cozy-konnector-libs
      json: false,
      // This allows request-promise to keep cookies between requests
      jar: true
    })
    
  }

  testSession() {
    return (this._jar.length > 0)
  }
  async fetch (fields) {
    log('info', 'Authenticating ...')
  
    await this.authenticate.bind(this)(fields.login, fields.password)
    log('info', 'Successfully logged in')
    // The BaseKonnector instance expects a Promise as return of the function
    

    // cheerio (https://cheerio.js.org/) uses the same api as jQuery (http://jquery.com/)
    log('info', 'Parsing list of documents')
    const documents = await this.parseDocuments()
  
    // Here we use the saveBills function even if what we fetch are not bills,
    // but this is the most common case in connectors
    log('info', 'Saving data to Cozy')
    await this.saveFiles(documents, fields, {
      timeout: Date.now() + 300 * 1000
    })

  }
  async authenticate(username, password)
  {
    return this.signin({
      url: `https://www.gestion-epargne-salariale.fr/epsens/fr/identification/authentification.html`,
      formSelector: 'form',
      formData: { 
        _cm_user : username, 
        _cm_pwd :password 
      },
      // The validate function will check if the login request was a success. Every website has a
      // different way to respond: HTTP status code, error message in HTML ($), HTTP redirection
      // (fullResponse.request.uri.href)...
      validate: (statusCode, $, fullResponse) => {
        log(
          'debug',
          fullResponse.request.uri.href,
          'not used here but should be useful for other connectors'
        )
        // The login in toscrape.com always works except when no password is set
        if ($(`a.ei_tpl_ident_logout`).length > 0) {
          return true
        } else {
          // cozy-konnector-libs has its own logging function which format these logs with colors in
          // standalone and dev mode and as JSON in production mode
          log('error', $('.error').text())
          return false
        }
      }
    })
  }
  async parseDocuments()
  {
    const $ = await this.request("https://www.gestion-epargne-salariale.fr/epsens/fr/epargnants/documents/releves/index.html")

    const docs = scrape(
      $,
      {
        title: {
          sel: 'td span.eir_hidesm'
        },
        date: {
          sel: 'td:nth-child(3)', 
          parse: sDate => this.DateFromString(sDate)
        },
        fileurl: {
          sel: 'td a',
          attr: 'href',
          parse: src => `${baseUrl}/${src}`
        }
      },
      '.___UpdatePanel table tbody tr'
    )
    return docs.map(doc => ({
      ...doc,
      filename: this.buildFileName(doc.title, doc.date),
     
    }))

  }
  buildFileName(sTitle, oDate)
  {
    return sTitle + "_" + oDate.getFullYear() + ".pdf"
  }
  DateFromString(sDate)
{
  // sDate :  27/01/2008
  var regex = /([0-9]{2,4})/g
  var found = sDate.match(regex)
  return new Date(found[2] + '-' + found[1] + '-' + found[0])
}

// Convert a Date object to a ISO date string
formatDate(date, annee) {  
  
  let year = date.getFullYear()
  let month = date.getMonth() + 1
  let day = date.getDate()
  if (month < 10) {
    month = '0' + month
  }
  if (day < 10) {
    day = '0' + day
  }
  return annee + `_${year}-${month}-${day}`
}
}


var oConnecteur = new EpsensConnector()
oConnecteur.run()