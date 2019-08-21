export default class Utils {
  static validateEmail(email) {
    const re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (email instanceof Array) {
      let valid: boolean = true;
      email.forEach(mail => {
        if (mail) {
          valid = re.test(String(mail).toLowerCase())
        }
      })
      return valid;
    } else {
      return re.test(String(email).toLowerCase());
    }
  }
}

