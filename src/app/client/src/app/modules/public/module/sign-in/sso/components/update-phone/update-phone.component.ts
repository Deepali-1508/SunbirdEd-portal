import { FormGroup, FormControl, Validators } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Component, OnInit, AfterViewInit, ViewChild } from '@angular/core';
import { TenantService, UserService, OtpService } from '@sunbird/core';
import { first, delay } from 'rxjs/operators';
import { ResourceService, ToasterService, NavigationHelperService } from '@sunbird/shared';
import * as _ from 'lodash-es';

@Component({
  templateUrl: './update-phone.component.html',
  styleUrls: ['./update-phone.component.scss']
})
export class UpdatePhoneComponent implements OnInit, AfterViewInit {
  @ViewChild('contactDetailsForm') private contactDetailsForm;
  public telemetryImpression;
  public submitPhoneInteractEdata;
  public tenantInfo: any = {};
  public showOtpComp = false;
  public userBlocked = false;
  public disableSubmitBtn = true;
  public otpData = {};
  public userDetails: any = {};
  public showError = false;
  public validationPattern = {
    phone: /^[6-9]\d{9}$/,
    email: /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,4}$/
  };
  public contactForm = {
    value: '',
    type: 'phone'
  };
  constructor(public activatedRoute: ActivatedRoute, private tenantService: TenantService, public resourceService: ResourceService,
    public userService: UserService, public otpService: OtpService, public toasterService: ToasterService,
    public navigationhelperService: NavigationHelperService) { }

  ngOnInit() {
    this.setTenantInfo();
    this.setTelemetryData();
  }
  ngAfterViewInit () {
    this.handleFormChangeEvent();
    setTimeout(() => {
      this.telemetryImpression = {
        context: {
          env: this.activatedRoute.snapshot.data.telemetry.env,
        },
        edata: {
          type: this.activatedRoute.snapshot.data.telemetry.type,
          pageid: this.activatedRoute.snapshot.data.telemetry.pageid,
          uri: this.activatedRoute.snapshot.data.telemetry.uri,
          duration: this.navigationhelperService.getPageLoadTime()
        }
      };
    });
  }
  handleFormChangeEvent() {
    this.contactDetailsForm.valueChanges.pipe(delay(1)).subscribe((data, data2) => {
      if (_.get(this.contactDetailsForm, 'controls.value.status') === 'VALID'
        && this.validationPattern[this.contactForm.type].test(this.contactForm.value)) {
          this.checkUserExist();
      } else {
        this.disableSubmitBtn = true;
      }
    });
  }
  private checkUserExist() {
    const uri = this.contactForm.type + '/' + this.contactForm.value;
    this.userService.getUserByKey(uri).subscribe(data => {
        this.userDetails = data.result.response;
        this.disableSubmitBtn = false;
      }, err => {
        if (_.get(err, 'error.params.status') && err.error.params.status === 'USER_ACCOUNT_BLOCKED') {
          this.userBlocked =  true;
          return;
        }
        this.disableSubmitBtn = false;
    });
  }
  public handleSubmitEvent() {
    const request = {
      request: {
        'key': this.contactForm.value,
        'type': this.contactForm.type
      }
    };
    this.otpService.generateOTP(request).subscribe((data) => {
        this.prepareOtpData();
        this.showOtpComp = true;
      }, (err) => {
        const errorMessage = (err.error.params.status === 'PHONE_ALREADY_IN_USE') || (err.error.params.status === 'EMAIL_IN_USE') ||
          (err.error.params.status === 'ERROR_RATE_LIMIT_EXCEEDED') ? err.error.params.errmsg : this.resourceService.messages.fmsg.m0085;
        this.toasterService.error(errorMessage);
      }
    );
  }
  resetForm(type = 'phone') {
    this.disableSubmitBtn = true;
    this.contactForm = {
      value: '',
      type: type
    };
    this.userDetails = {};
    this.userBlocked = false;
  }
  private prepareOtpData() {
    this.otpData = {
      type: this.contactForm.type,
      value: this.contactForm.value,
      instructions: this.contactForm.type === 'phone' ?
        this.resourceService.frmelmnts.instn.t0083 : this.resourceService.frmelmnts.instn.t0084,
      retryMessage: this.contactForm.type === 'phone' ?
        this.resourceService.frmelmnts.lbl.unableToUpdateMobile : this.resourceService.frmelmnts.lbl.unableToUpdateEmail,
      wrongOtpMessage: this.contactForm.type === 'phone' ? this.resourceService.frmelmnts.lbl.wrongPhoneOTP :
        this.resourceService.frmelmnts.lbl.wrongEmailOTP
    };
  }
  public handleOtpValidationFailed() {
    this.showOtpComp = false;
    this.resetForm();
    setTimeout(() => this.handleFormChangeEvent(), 100);
  }
  getQueryParams(queryObj) {
    return '?' + Object.keys(queryObj).filter(key => queryObj[key])
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(queryObj[key])}`)
      .join('&');
  }
  public handleOtpValidationSuccess() {
    let query: any = {
      type: this.contactForm.type,
      value: this[this.contactForm.type]
    };
    if (_.isEmpty(this.userDetails)) {
      query = {
        userId: this.userDetails.id
      };
    }
    window.location.href = `/v1/sso/contact/verified` +
    this.getQueryParams({ ...this.activatedRoute.snapshot.queryParams, ...query});
  }
  private setTelemetryData() {
    this.submitPhoneInteractEdata = {
      id: 'submit-phone',
      type: 'click',
      pageid: 'sso-sign-in',
    };
  }
  private setTenantInfo() {
    this.tenantService.tenantData$.pipe(first()).subscribe(data => {
      if (!data.err) {
        this.tenantInfo = {
          logo: data.tenantData.logo,
          tenantName: data.tenantData.titleName
        };
      }
    });
  }
}
