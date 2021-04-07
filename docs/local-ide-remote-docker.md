# Deploy

1. [Setup dropbox on remote machine](https://training.shoppinpal.com/setup-box-on-azure/setup-dropbox-on-azure.html)
1. On remote, setup the following env variables:

    ```
    # edit and replace any env variable's value, based on your needs
    # or feel free to use the defaults
    # if a dir specified as a value doesn't exist then create it before setting the env variables
    export MASTER_DEV_HOME=`echo ~/dev`
    export SYNC_DEV_HOME=`echo ~/Dropbox/remote-dev`
    export WAREHOUSE_PROJECT_NAME=warehouse-1
    export WAREHOUSE_SYNC_DIR_NAME=`echo $WAREHOUSE_PROJECT_NAME.sync`
    export WAREHOUSE_HOME=`echo $MASTER_DEV_HOME/$WAREHOUSE_PROJECT_NAME`

    # spit out and confirm the values for all of the following before proceeding
    echo MASTER_DEV_HOME=$MASTER_DEV_HOME && \
      echo WAREHOUSE_PROJECT_NAME=$WAREHOUSE_PROJECT_NAME && \
      echo MASTER_DEV_HOME + WAREHOUSE_PROJECT_NAME = WAREHOUSE_HOME = $WAREHOUSE_HOME && \
      echo SYNC_DEV_HOME=$SYNC_DEV_HOME && \
      echo WAREHOUSE_SYNC_DIR_NAME=$WAREHOUSE_SYNC_DIR_NAME && \
      echo SYNC_DEV_HOME + WAREHOUSE_SYNC_DIR_NAME = $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME
    ```
    * Optionally, you can create and save a `setenv_master.sh` file for reuse in future sessions but do not commit it:

        ```
        #!/bin/sh

        echo "###"
        echo Its best to invoke this script as: '. ./setenv_master.sh' rather than './setenv_master.sh'
        echo "###"

        export MASTER_DEV_HOME=`echo ~/dev` && \
            export SYNC_DEV_HOME=`echo ~/Dropbox/remote-dev` && \
            export WAREHOUSE_PROJECT_NAME=warehouse-1 && \
            export WAREHOUSE_SYNC_DIR_NAME=`echo $WAREHOUSE_PROJECT_NAME.sync` && \
            export WAREHOUSE_HOME=`echo $MASTER_DEV_HOME/$WAREHOUSE_PROJECT_NAME` && \
        echo MASTER_DEV_HOME=$MASTER_DEV_HOME && \
            echo WAREHOUSE_PROJECT_NAME=$WAREHOUSE_PROJECT_NAME && \
            echo MASTER_DEV_HOME + WAREHOUSE_PROJECT_NAME = WAREHOUSE_HOME = $WAREHOUSE_HOME && \
            echo SYNC_DEV_HOME=$SYNC_DEV_HOME && \
            echo WAREHOUSE_SYNC_DIR_NAME=$WAREHOUSE_SYNC_DIR_NAME && \
            echo SYNC_DEV_HOME + WAREHOUSE_SYNC_DIR_NAME = $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME
        ```
1. On remote, clone warehouse and any submodules

    ```
    cd $MASTER_DEV_HOME && \
      git clone --recursive git@github.com:ShoppinPal/warehouse.git $WAREHOUSE_PROJECT_NAME && \
      cd $WAREHOUSE_HOME
    ```
1. On remote, before making our project sync-capable, let us add rules to prevent unnecessary stuff from syncing:

    ```
    # change this according to your needs before running
    export WAREHOUSE_SYNC_DIR_NAME=warehouse-sync-pr-xxx && echo $WAREHOUSE_SYNC_DIR_NAME

    # run this as-is
    dropbox exclude add $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME/.git && \
      dropbox exclude add $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME/node_modules && \
      dropbox exclude add $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME/docker/volumes && \
      dropbox exclude add $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME/warehouse-workers/.git && \
      dropbox exclude add $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME/warehouse-workers/node_modules
    ```
1. On remote, check if they are now excluded, use `dropbox exclude list | grep $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME`
    * if an incorrect path was excluded, you can fix it with: `dropbox exclude remove /the/path`
    * for example, if you decide to sync the `.git` folder over to your local then un-exclude it with: `dropbox exclude remove $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME/.git`
1. On remote, wire up your project root to be synced via Dropbox:
    * go to your WAREHOUSE_HOME: `cd $WAREHOUSE_HOME`
    * then run the following command:

        ```
        # make sure this is setup by printing it out
        echo WAREHOUSE_SYNC_DIR_NAME=$WAREHOUSE_SYNC_DIR_NAME

        # make sure this is setup by printing it out
        echo WAREHOUSE_HOME=$WAREHOUSE_HOME

        # then, run as-is
        cd $WAREHOUSE_HOME && \
          ln -s `pwd` ~/Dropbox/remote-dev/$WAREHOUSE_SYNC_DIR_NAME
        ```
    * make sure it worked: `ls -alrt ~/Dropbox/remote-dev/`
1. On remote, when you check the status via: `dropbox status` ... you will see that the sync has begun
    ```
    Syncing (353 files remaining)
    Indexing 353 files...
    ```
1. Setup dropbox on local machine
1. On local, setup the following env variables:

    ```
    # edit and replace any env variable's value, based on your needs
    # or feel free to use the defaults
    # if a dir specified as a value doesn't exist then create it before setting the env variables
    export SYNC_DEV_HOME=`echo ~/Dropbox/remote-dev`
    export WAREHOUSE_PROJECT_NAME=warehouse-1
    export WAREHOUSE_SYNC_DIR_NAME=`echo $WAREHOUSE_PROJECT_NAME.sync`
    export SLAVE_WAREHOUSE_HOME=`echo $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME`

    # spit out and confirm the values for all of the following before proceeding
    echo SYNC_DEV_HOME=$SYNC_DEV_HOME && \
      echo WAREHOUSE_PROJECT_NAME=$WAREHOUSE_PROJECT_NAME && \
      echo WAREHOUSE_SYNC_DIR_NAME=$WAREHOUSE_SYNC_DIR_NAME && \
      echo SLAVE_WAREHOUSE_HOME = $SLAVE_WAREHOUSE_HOME
    ```
    * Optionally, you can create and save a `setenv_slave.sh` file for reuse in future sessions but do not commit it:

        ```
        #!/bin/sh

        echo "###"
        echo Its best to invoke this script as: '. ./setenv_slave.sh' rather than './setenv_slave.sh'
        echo "###"

        export SYNC_DEV_HOME=`echo ~/Dropbox/remote-dev` && \
            export WAREHOUSE_PROJECT_NAME=warehouse-1 && \
            export WAREHOUSE_SYNC_DIR_NAME=`echo $WAREHOUSE_PROJECT_NAME.sync` && \
            export SLAVE_WAREHOUSE_HOME=`echo $SYNC_DEV_HOME/$WAREHOUSE_SYNC_DIR_NAME` && \
        echo SYNC_DEV_HOME=$SYNC_DEV_HOME && \
            echo WAREHOUSE_PROJECT_NAME=$WAREHOUSE_PROJECT_NAME && \
            echo WAREHOUSE_SYNC_DIR_NAME=$WAREHOUSE_SYNC_DIR_NAME && \
            echo SLAVE_WAREHOUSE_HOME = $SLAVE_WAREHOUSE_HOME
        ```
1. On local, Dropbox's autosync will create a directory and you can jump into it: `cd $SLAVE_WAREHOUSE_HOME`
1. On local, open your favorite IDE and start working
    * for example, visual studio can be opened with: `cd $SLAVE_WAREHOUSE_HOME && code .`
1. On master, create empty env files: `cd $WAREHOUSE_HOME && touch .env worker.env worker2.env`
    * run: `docker-compose run nodejs npm install inquirer --save-dev`
    * then run the command `npm run generate-env -e=terraform` for generating a `terraform.tfvars` file.
        * It will be used by [terraform](https://www.terraform.io/) to generate queues in your AWS [SQS](https://aws.amazon.com/sqs/) infrastructure.
        * Run these commands:

            ```
            # Tested with Terraform v0.10.8 as of this commit.

            # step 1
            cd $WAREHOUSE_HOME/terraform/
            # step 2
            docker-compose run terraform init
            # step 3: used to download and update modules mentioned in the root module (main.tf).
            docker-compose run terraform get
            # step 4
            docker-compose run terraform plan
            # step 5
            docker-compose run terraform apply
            # step 6: to destroy your infrastructure!
            docker-compose run terraform destroy
            ```
        * Once terraform creates queues, the appropriate AWS_SQS_URL and AWS_SQS_REGION will be automatically added to your .env and worker.env files.
    * then run the command `docker-compose run nodejs npm run generate-env -e=web` for configuring the remaining portions of `.env` file for warehouse web service
        * It will ask you for the environment variables to be configured.
        * Once done, it will generate files for you as per the values you specified.
    * then run the command `docker-compose run nodejs npm run generate-env -e=worker` for configuring the remaining portions of `worker.env` for warehouse worker service.
    * then run the command `npm run generate-env -e=worker2` for configuring the remaining portions of `worker2.env` for warehouse worker2 service.
1. Fill in any remaining values that are empty in `.env` and `worker.env` and `worker2.env` files
1. Open file `/etc/hosts`: `sudo vim /etc/hosts`
    * Append the following line

        ```
        127.0.0.1 lb
        ```
1. To build and run, choose:
    * background: `docker-compose up -d --build`
    * foreground: `docker-compose up --build`
1. For local development, open application in your browser with url http://lb/
